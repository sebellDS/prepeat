#!/usr/bin/env bash
#
# Backs up the live Supabase database - and decides for itself whether a backup
# is due. One script, one scheduled job.
#
# WHY IT LOOKS LIKE THIS (Thomas, 2026-08-04: "too patched together, and I need
# my Mac awake in the middle of the night"):
#   - No 03:15 schedule. It runs AT LOGIN and every 6 hours while the Mac is on,
#     and does nothing unless the newest backup is over 12 hours old. A laptop is
#     not a server; asking it to be awake at a fixed hour was the wrong shape.
#     Open the lid after a week away and it catches up by itself.
#   - It also carries the "have the backups stopped?" warning, which used to be
#     a second script and a second job. Half the moving parts.
#
# Two gaps this design knowingly accepts:
#   - If the scheduled job is removed, no separate watchdog notices. That was
#     the price of halving the parts.
#   - The backup is on this Mac only. iCloud was tried and does not work for a
#     background job (see DEST below); off-site means Time Machine or Pro.
#
# ---------------------------------------------------------------------------
# THIS FILE IS THE SOURCE. IT IS NOT THE COPY THAT RUNS.
# After editing, run:  npm run backup:install
# (macOS forbids background jobs from reading ~/Documents, so the running copy
# lives in ~/Library/Application Support/Prepeat.)
# ---------------------------------------------------------------------------
#
# Depends on nothing but psql and curl - no Docker, no node, no Supabase CLI.
# Credentials: ~/.prepeat-backup.env (mode 600), never in this repo, which is
# public.
#
#   npm run backup        back up now, whatever the schedule thinks
#   (scheduled)           back up only if the newest is over 12 hours old

set -uo pipefail

# NOT iCloud Drive, though it was tried on 2026-08-04: a launchd job gets
# partial, unreliable access there. It wrote the database archive, was refused
# on all 267 photos ("Operation not permitted"), and could not read the folder
# it had just written - so it re-fetched everything every run. Off-site has to
# come from Time Machine or Supabase Pro, not from here.
DEST="${PREPEAT_BACKUP_DIR:-$HOME/Prepeat-backups}"

ENV_FILE="${PREPEAT_BACKUP_ENV:-$HOME/.prepeat-backup.env}"
MIN_INTERVAL_HOURS="${PREPEAT_BACKUP_MIN_INTERVAL_HOURS:-12}"
MAX_AGE_DAYS="${PREPEAT_BACKUP_MAX_AGE_DAYS:-3}"
KEEP=30
MIN_BYTES=10240
PG_BIN="/opt/homebrew/opt/libpq/bin"
BUCKET="recipe-photos"
RUNTIME="$HOME/Library/Application Support/Prepeat"

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

newest_archive() { ls -1t "$DEST"/prepeat-*.tar.gz 2>/dev/null | head -1; }

age_days() {   # age of $1 in whole days, or 9999 if it does not exist
  [ -n "${1:-}" ] && [ -f "$1" ] || { echo 9999; return; }
  echo $(( ( $(date +%s) - $(stat -f %m "$1" 2>/dev/null || echo 0) ) / 86400 ))
}
age_hours() {
  [ -n "${1:-}" ] && [ -f "$1" ] || { echo 9999; return; }
  echo $(( ( $(date +%s) - $(stat -f %m "$1" 2>/dev/null || echo 0) ) / 3600 ))
}

# Run by hand: say it in the terminal. Run by launchd: say it on screen, since
# nobody is reading a log file. `giving up after` so an undismissed dialog can
# never keep the job alive for ever.
warn() {
  local msg="$1"
  log "WARNING: $msg"
  [ -t 1 ] && return 0
  osascript >/dev/null 2>&1 <<APPLESCRIPT
    display dialog "$msg" ¬
      with title "Prep+Eat backup" ¬
      with icon caution ¬
      buttons {"Later", "Try again now"} ¬
      default button "Try again now" ¬
      giving up after 300
    if button returned of result is "Try again now" then
      do shell script "'$RUNTIME/backup-supabase.sh' --force > /dev/null 2>&1 &"
    end if
APPLESCRIPT
  osascript -e "display notification \"$msg\" with title \"Prep+Eat backup\"" >/dev/null 2>&1
}

# --- is a backup even due? --------------------------------------------------

NEWEST="$(newest_archive)"
HOURS="$(age_hours "$NEWEST")"

if [ "$FORCE" -eq 0 ] && [ "$HOURS" -lt "$MIN_INTERVAL_HOURS" ]; then
  log "skip – newest backup is ${HOURS}h old (backing up every ${MIN_INTERVAL_HOURS}h)"
  exit 0
fi

# --- preconditions ----------------------------------------------------------
# A missing tool or missing credentials is a real problem, not a transient one,
# so it always warns.

fail_hard() { warn "$1"; exit 1; }

[ -x "$PG_BIN/pg_dump" ] || fail_hard "Prep+Eat cannot back up: pg_dump is missing. Run: brew install libpq"
[ -f "$ENV_FILE" ]      || fail_hard "Prep+Eat cannot back up: the database password file is missing ($ENV_FILE)."

set -a; . "$ENV_FILE" 2>/dev/null; set +a
[ -n "${SUPABASE_DB_URL:-}" ] || fail_hard "Prep+Eat cannot back up: no database connection string in $ENV_FILE."

mkdir -p "$DEST" && chmod 700 "$DEST"

# --- the backup itself ------------------------------------------------------
# Wrapped so a failure can be judged against how old the last good backup is,
# rather than firing a dialog at every flaky moment on the wifi.

do_backup() {
  local work stamp archive size
  stamp="$(date '+%Y-%m-%d-%H%M')"
  work="$(mktemp -d "${TMPDIR:-/tmp}/prepeat-backup.XXXXXX")" || return 1
  trap 'rm -rf "$work"' RETURN

  log "dumping public schema (schema + data)"
  "$PG_BIN/pg_dump" "$SUPABASE_DB_URL" \
    --schema=public \
    --no-owner --no-privileges --no-password --quote-all-identifiers \
    -f "$work/public.sql" || { log "pg_dump of public failed"; return 1; }

  # An ALLOWLIST of four tables, not the whole auth/storage schemas: dumping
  # everything drags in service-owned tables a restore is refused outright
  # (schema_migrations, then buckets_vectors - two rehearsal failures), and a
  # denylist would break again the next time Supabase adds an internal table.
  # Sessions and refresh tokens are deliberately dropped; people sign in again
  # after a restore, which a rebuilt project would force anyway.
  log "dumping accounts + storage metadata (data only)"
  "$PG_BIN/pg_dump" "$SUPABASE_DB_URL" \
    --table=auth.users --table=auth.identities \
    --table=storage.buckets --table=storage.objects \
    --data-only --no-owner --no-privileges --no-password --quote-all-identifiers \
    -f "$work/auth-storage-data.sql" || { log "pg_dump of accounts failed"; return 1; }

  archive="$DEST/prepeat-$stamp.tar.gz"
  tar -czf "$archive" -C "$work" public.sql auth-storage-data.sql || return 1
  chmod 600 "$archive"

  size=$(wc -c < "$archive" | tr -d ' ')
  if [ "$size" -lt "$MIN_BYTES" ]; then
    log "archive is only ${size}B – discarding it rather than rotating good ones away"
    rm -f "$archive"; return 1
  fi
  log "wrote $(basename "$archive") (${size} bytes)"

  # Rotation only ever runs after a verified-good archive, so a run of failures
  # can never eat the history.
  ls -1t "$DEST"/prepeat-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    log "rotating out $(basename "$old")"; rm -f "$old"
  done
  return 0
}

# --- recipe photos ----------------------------------------------------------
# The photo FILES are in Supabase Storage, not Postgres - pg_dump sees only
# their metadata. The bucket is public-read, so no credentials are needed. This
# is a MIRROR: unchanged files are skipped, and a photo deleted upstream is
# KEPT here, deletion being the case a backup exists for.

do_photos() {
  local ref photos list target size got=0 skipped=0 failed=0
  photos="$DEST/recipe-photos"; mkdir -p "$photos"
  ref="${SUPABASE_PROJECT_REF:-$(printf '%s' "$SUPABASE_DB_URL" | sed -n 's|.*://postgres\.\([a-z0-9]*\):.*|\1|p')}"
  [ -n "$ref" ] || { log "cannot work out the project ref – skipping photos"; return 1; }

  list="$(mktemp)"; trap 'rm -f "$list"' RETURN
  "$PG_BIN/psql" "$SUPABASE_DB_URL" -w -A -t -F'|' \
    -c "select name, coalesce((metadata->>'size')::bigint,0) from storage.objects where bucket_id='$BUCKET';" \
    > "$list" 2>/dev/null || { log "could not list photos"; return 1; }

  while IFS='|' read -r name size; do
    [ -n "$name" ] || continue
    target="$photos/$name"
    if [ -f "$target" ] && [ "$(wc -c < "$target" | tr -d ' ')" = "$size" ]; then
      skipped=$((skipped+1)); continue
    fi
    mkdir -p "$(dirname "$target")"
    if curl -fsS --max-time 60 \
         "https://$ref.supabase.co/storage/v1/object/public/$BUCKET/$name" \
         -o "$target.part" 2>/dev/null; then
      mv "$target.part" "$target"; got=$((got+1))
    else
      rm -f "$target.part"; failed=$((failed+1))
    fi
  done < "$list"

  log "photos: $got fetched, $skipped already current, $failed failed"
  [ "$failed" -eq 0 ]
}

# --- run, then judge --------------------------------------------------------

log "backing up to $DEST"

if do_backup; then
  do_photos || log "photo mirror incomplete – the database backup is still good"
else
  # How bad is this? Judged against the last GOOD backup, so one flaky moment
  # on the wifi is retried at the next tick instead of raising a dialog.
  DAYS="$(age_days "$(newest_archive)")"
  if [ "$DAYS" -ge 9999 ]; then
    warn "Prep+Eat has no database backup at all, and the attempt just now failed."
  elif [ "$DAYS" -gt "$MAX_AGE_DAYS" ]; then
    warn "Prep+Eat backups have been failing. The newest one is $DAYS days old."
  else
    log "backup failed, but the newest is only ${DAYS}d old – will retry at the next run"
  fi
  exit 1
fi

# Keep the log from growing for ever - launchd appends to it. It lives in
# ~/Library/Logs, NOT in iCloud: launchd cannot open a log file inside iCloud
# Drive and silently refuses to start the job at all.
LOGFILE="$HOME/Library/Logs/prepeat-backup.log"
if [ -f "$LOGFILE" ] && [ "$(wc -l < "$LOGFILE" | tr -d ' ')" -gt 1000 ]; then
  tail -1000 "$LOGFILE" > "$LOGFILE.trim" && mv "$LOGFILE.trim" "$LOGFILE"
fi

log "done – $(ls -1 "$DEST"/prepeat-*.tar.gz 2>/dev/null | wc -l | tr -d ' ') archives, $(find "$DEST/recipe-photos" -type f 2>/dev/null | wc -l | tr -d ' ') photos"
