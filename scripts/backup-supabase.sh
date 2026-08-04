#!/usr/bin/env bash
#
# Nightly off-site backup of the LIVE Supabase database.
#
# Why this exists: the Supabase Free plan takes NO automatic backups at all,
# and a migration reaches every user the moment it is applied. Until the
# project moves to Pro at public launch, this is the only copy of the
# production data that Supabase does not hold. See the 2026-08-04 decision in
# docs/backlog.md.
#
# ---------------------------------------------------------------------------
# THIS FILE IS THE SOURCE. IT IS NOT THE COPY THAT RUNS NIGHTLY.
#
# ~/Documents is a macOS privacy-protected folder, and a launchd job cannot
# read from it – the first scheduled run failed with "Operation not permitted"
# (exit 126) while the same script run by hand from Terminal worked fine.
# So the job runs an installed copy in ~/Library/Application Support/Prepeat.
#
# AFTER EDITING THIS FILE, RUN:  npm run backup:install
# ...otherwise the nightly job keeps running the old version.
#
# For the same reason this script depends on nothing inside the repo: no node,
# no npx, no Supabase CLI. Only psql and curl.
# ---------------------------------------------------------------------------
#
# Secrets live in ~/.prepeat-backup.env (mode 600), never in this repo, which
# is public. Backups land in ~/Prepeat-backups, outside the repo and outside
# iCloud.
#
# Run by hand:  npm run backup
#
# WARNING: the archives contain real user data (email addresses, recipes).
# Do not copy them into the repo, a shared drive, or cloud storage.

set -euo pipefail

ENV_FILE="${PREPEAT_BACKUP_ENV:-$HOME/.prepeat-backup.env}"
DEST="${PREPEAT_BACKUP_DIR:-$HOME/Prepeat-backups}"
KEEP=30                     # how many nightly archives to retain
MIN_BYTES=10240             # a smaller archive than this means something broke
PG_BIN="/opt/homebrew/opt/libpq/bin"
BUCKET="recipe-photos"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "FAILED: $*" >&2; exit 1; }

# --- preconditions ----------------------------------------------------------

[ -x "$PG_BIN/pg_dump" ] || die "pg_dump not found in $PG_BIN (brew install libpq)"
[ -x "$PG_BIN/psql" ]    || die "psql not found in $PG_BIN (brew install libpq)"
[ -f "$ENV_FILE" ]       || die "missing $ENV_FILE – see docs/backlog.md for setup"

# shellcheck source=/dev/null
set -a; . "$ENV_FILE"; set +a
[ -n "${SUPABASE_DB_URL:-}" ] || die "SUPABASE_DB_URL is not set in $ENV_FILE"

mkdir -p "$DEST"
chmod 700 "$DEST"

STAMP="$(date '+%Y-%m-%d-%H%M')"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/prepeat-backup.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

log "backing up to $DEST"

# --- the app's own data -----------------------------------------------------
# Schema + data for `public`. This is the part worth reading by hand: recipes,
# meal plans, shopping lists, households. --no-owner/--no-privileges so it can
# be restored into a fresh Supabase project, whose roles differ.

log "dumping public schema (schema + data)"
"$PG_BIN/pg_dump" "$SUPABASE_DB_URL" \
  --schema=public \
  --no-owner --no-privileges --no-password \
  --quote-all-identifiers \
  -f "$WORK/public.sql" || die "pg_dump of public failed"

# --- accounts and file metadata ---------------------------------------------
# auth and storage are Supabase-managed schemas: their TABLES come back with a
# new project, so only the ROWS are ours to keep. auth.users is what makes a
# restored database still belong to the same people.

# An ALLOWLIST of four tables, not the whole schemas. Dumping everything in
# auth/storage drags in service-owned tables that a restore is refused outright
# ("permission denied for table schema_migrations", then buckets_vectors) - two
# separate rehearsal failures on 2026-08-04, and a denylist would have broken
# again the next time Supabase added an internal table.
#
# What is deliberately NOT kept: sessions, refresh tokens, MFA claims, one-time
# tokens, audit logs. All transient. After a restore people sign in again -
# which they would have to anyway, because a rebuilt project has a new JWT
# secret that old tokens cannot match.
log "dumping accounts + storage metadata (data only)"
"$PG_BIN/pg_dump" "$SUPABASE_DB_URL" \
  --table=auth.users \
  --table=auth.identities \
  --table=storage.buckets \
  --table=storage.objects \
  --data-only --no-owner --no-privileges --no-password \
  --quote-all-identifiers \
  -f "$WORK/auth-storage-data.sql" || die "pg_dump of accounts/storage failed"

# --- seal the database side -------------------------------------------------
# Done before the photos, so a photo problem can never cost us the dump.

ARCHIVE="$DEST/prepeat-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK" public.sql auth-storage-data.sql
chmod 600 "$ARCHIVE"

SIZE=$(wc -c < "$ARCHIVE" | tr -d ' ')
[ "$SIZE" -ge "$MIN_BYTES" ] \
  || die "archive is only ${SIZE}B – refusing to rotate good backups away"

log "wrote $(basename "$ARCHIVE") (${SIZE} bytes)"

# --- rotate -----------------------------------------------------------------
# Only ever runs after a verified-good archive, so a run of failures can never
# eat the history.

ls -1t "$DEST"/prepeat-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  log "rotating out $(basename "$old")"
  rm -f "$old"
done

# --- recipe photos ----------------------------------------------------------
# The photo FILES live in Supabase Storage, not in Postgres – pg_dump sees only
# their metadata rows. The bucket is public-read, so they need no credentials;
# the object list comes from the database and each file is fetched by URL.
#
# This is a MIRROR, not a nightly snapshot: unchanged files are skipped, and a
# photo deleted upstream is KEPT here. Deletion is the case a backup exists for.

PHOTOS="$DEST/recipe-photos"
mkdir -p "$PHOTOS"

# Project ref sits in the pooler username: postgres.<ref>
REF="${SUPABASE_PROJECT_REF:-$(printf '%s' "$SUPABASE_DB_URL" | sed -n 's|.*://postgres\.\([a-z0-9]*\):.*|\1|p')}"
[ -n "$REF" ] || die "could not work out the project ref – set SUPABASE_PROJECT_REF in $ENV_FILE"

log "mirroring photos from $BUCKET"
LIST="$WORK/objects.txt"
"$PG_BIN/psql" "$SUPABASE_DB_URL" -w -A -t -F'|' \
  -c "select name, coalesce((metadata->>'size')::bigint, 0) from storage.objects where bucket_id = '$BUCKET';" \
  > "$LIST" 2>/dev/null || { log "WARNING: could not list photos – database backup is still good"; LIST=""; }

got=0; skipped=0; failed=0
if [ -n "$LIST" ]; then
  while IFS='|' read -r name size; do
    [ -n "$name" ] || continue
    target="$PHOTOS/$name"
    # Already have it at the right size? Leave it alone.
    if [ -f "$target" ] && [ "$(wc -c < "$target" | tr -d ' ')" = "$size" ]; then
      skipped=$((skipped + 1)); continue
    fi
    mkdir -p "$(dirname "$target")"
    if curl -fsS --max-time 60 \
         "https://$REF.supabase.co/storage/v1/object/public/$BUCKET/$name" \
         -o "$target.part" 2>/dev/null; then
      mv "$target.part" "$target"
      got=$((got + 1))
    else
      rm -f "$target.part"
      failed=$((failed + 1))
    fi
  done < "$LIST"
fi

log "photos: $got fetched, $skipped already current, $failed failed"
[ "$failed" -eq 0 ] || log "WARNING: $failed photo(s) failed – database backup is still good"

log "done – $(ls -1 "$DEST"/prepeat-*.tar.gz 2>/dev/null | wc -l | tr -d ' ') archives, $(find "$PHOTOS" -type f 2>/dev/null | wc -l | tr -d ' ') photos"

# launchd appends to the log forever. Keep the last 1000 lines - roughly three
# months of nightly runs, which is more history than anyone reads, and stops a
# years-old file slowing down the freshness check that reads it.
LOGFILE="$DEST/backup.log"
if [ -f "$LOGFILE" ] && [ "$(wc -l < "$LOGFILE" | tr -d ' ')" -gt 1000 ]; then
  tail -1000 "$LOGFILE" > "$LOGFILE.trim" && mv "$LOGFILE.trim" "$LOGFILE"
fi
