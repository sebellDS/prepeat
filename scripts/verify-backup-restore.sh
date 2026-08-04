#!/usr/bin/env bash
#
# Rehearses a real disaster recovery: restores the newest backup into the LOCAL
# Supabase stack and checks that every row arrived.
#
#   npm run db:start        # once, if it is not already running
#   npm run backup:verify
#
# Why this exists: a backup nobody has restored is a hypothesis, not a backup.
# The first two attempts on 2026-08-04 both failed, and neither failure was
# visible from the backup file alone - see docs/backlog.md.
#
# WHY THE LOCAL SUPABASE DATABASE AND NOT A SCRATCH ONE:
# the dump refers to the `auth` and `storage` schemas - RLS policies call
# auth.uid(), and public tables carry foreign keys into auth.users. A plain
# empty Postgres database has none of that and the restore dies on line 9236.
# The only faithful target is something shaped like a Supabase project, which
# is exactly what the local stack is.
#
# DESTRUCTIVE TO LOCAL DEV DATA ONLY. It runs `supabase db reset` first, so it
# starts from a known state every time. It never connects to anything but
# 127.0.0.1 - production is not reachable from this script.
#
# Afterwards the local database holds the RESTORED production data rather than
# the migration-built schema. Run `npm run db:reset` to get the latter back.

set -euo pipefail

DEST="${PREPEAT_BACKUP_DIR:-$HOME/Prepeat-backups}"
PG_BIN="/opt/homebrew/opt/libpq/bin"
LOCAL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

log() { printf '%s  %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { log "FAILED: $*" >&2; exit 1; }
psql_q() { "$PG_BIN/psql" "$LOCAL" -w -q "$@"; }

[ -x "$PG_BIN/psql" ] || die "psql not found in $PG_BIN"

ARCHIVE="${1:-$(ls -1t "$DEST"/prepeat-*.tar.gz 2>/dev/null | head -1)}"
[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || die "no archive found in $DEST"

"$PG_BIN/psql" "$LOCAL" -w -c "select 1" >/dev/null 2>&1 \
  || die "local Supabase is not running - start it with: npm run db:start"

log "rehearsing restore of $(basename "$ARCHIVE")"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/prepeat-restore.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
tar -xzf "$ARCHIVE" -C "$WORK"
[ -f "$WORK/public.sql" ] || die "archive has no public.sql"
[ -f "$WORK/auth-storage-data.sql" ] || die "archive has no auth-storage-data.sql"

# --- what the dump SAYS it holds --------------------------------------------
# Read from the COPY blocks before anything is restored.

awk '/^COPY /{t=$2; n=0; inblk=1; next}
     inblk&&/^\\\.$/{gsub(/"/,"",t); print t"\t"n; inblk=0; next}
     inblk{n++}' "$WORK/public.sql" | sort > "$WORK/expected.tsv"

EXPECTED_TOTAL=$(awk -F'\t' '{s+=$2} END{print s+0}' "$WORK/expected.tsv")
log "dump claims $(wc -l < "$WORK/expected.tsv" | tr -d ' ') tables, $EXPECTED_TOTAL rows"

# --- a target shaped like a fresh Supabase project ---------------------------

log "resetting local Supabase to a known state"
(cd "$REPO" && npx --no-install supabase db reset >/dev/null 2>&1) \
  || die "supabase db reset failed - is Docker running?"

# Clear what the backup is about to replace. `drop schema public` takes the
# migration-built app tables with it; the two Supabase-managed schemas keep
# their tables and lose only their rows.
log "clearing the app schema and the rows the backup replaces"
psql_q -c "drop schema if exists public cascade;" >/dev/null
psql_q -c "truncate storage.objects, storage.buckets cascade;" >/dev/null
psql_q -c "delete from auth.users cascade;" >/dev/null

# --- restore, accounts first -------------------------------------------------
# ORDER MATTERS: public tables carry foreign keys into auth.users, so the
# accounts have to exist before the app data lands on top of them.

log "restoring accounts and storage metadata"
if ! "$PG_BIN/psql" "$LOCAL" -w -q -v ON_ERROR_STOP=1 \
       -f "$WORK/auth-storage-data.sql" > "$WORK/restore1.log" 2>&1; then
  tail -15 "$WORK/restore1.log"; die "auth/storage restore did not complete"
fi

log "restoring the app schema and data"
if ! "$PG_BIN/psql" "$LOCAL" -w -q -v ON_ERROR_STOP=1 \
       -f "$WORK/public.sql" > "$WORK/restore2.log" 2>&1; then
  tail -15 "$WORK/restore2.log"; die "public restore did not complete"
fi
log "both files restored with no errors"

# --- what actually landed ----------------------------------------------------
# Counted with count(*), not read from pg_stat_user_tables - those figures are
# estimates and would happily agree with a short restore.

: > "$WORK/actual.tsv"
while IFS=$'\t' read -r table _; do
  short="${table#public.}"
  n=$("$PG_BIN/psql" "$LOCAL" -w -A -t \
        -c "select count(*) from public.\"$short\";" 2>/dev/null || echo "ERR")
  printf '%s\t%s\n' "$table" "$n" >> "$WORK/actual.tsv"
done < "$WORK/expected.tsv"

echo
printf '%-48s %9s %9s\n' "TABLE" "IN DUMP" "RESTORED"
mismatch=0
while IFS=$'\t' read -r table want; do
  got=$(awk -F'\t' -v t="$table" '$1==t{print $2}' "$WORK/actual.tsv")
  flag=""
  if [ "$want" != "$got" ]; then flag="  <-- MISMATCH"; mismatch=$((mismatch + 1)); fi
  printf '%-48s %9s %9s%s\n' "$table" "$want" "$got" "$flag"
done < "$WORK/expected.tsv"
echo

USERS=$("$PG_BIN/psql" "$LOCAL" -w -A -t -c "select count(*) from auth.users;")
OBJECTS=$("$PG_BIN/psql" "$LOCAL" -w -A -t -c "select count(*) from storage.objects;")
SCHEMA=$("$PG_BIN/psql" "$LOCAL" -w -A -t -c "
  select (select count(*) from pg_tables where schemaname='public') || ' tables, ' ||
         (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public') || ' functions, ' ||
         (select count(*) from pg_policies where schemaname='public') || ' policies';")

log "accounts restored: $USERS   storage rows: $OBJECTS"
log "schema restored:   $SCHEMA"

[ "$mismatch" -eq 0 ] || die "$mismatch table(s) restored with the wrong row count"

log "VERIFIED: $EXPECTED_TOTAL rows across $(wc -l < "$WORK/expected.tsv" | tr -d ' ') tables, restored exactly"
log "local now holds restored production data - run 'npm run db:reset' to undo"
