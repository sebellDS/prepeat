#!/usr/bin/env bash
#
# Tells Thomas when the backups have stopped happening.
#
# The failure this exists for is not "there is no backup" - it is believing in
# one that quietly stopped in March. The nightly job cannot report its own
# absence: if the Mac is off, or the script breaks, nothing happens and nothing
# says so. So this runs separately and looks at the RESULT rather than the job.
#
# Runs at login and again at 10:00 daily. The login trigger is the important
# one: it is what catches "away for two weeks with the Mac shut", which is the
# realistic way this goes stale.
#
# Installed alongside the backup job by: npm run backup:install
# (Same reason as the backup script - a launchd job cannot read ~/Documents,
# so the copy that runs lives in ~/Library/Application Support/Prepeat.)

set -uo pipefail   # deliberately NOT -e: an alarm that dies silently is worse
                   # than no alarm, so every step below handles its own failure

DEST="${PREPEAT_BACKUP_DIR:-$HOME/Prepeat-backups}"
MAX_AGE_DAYS="${PREPEAT_BACKUP_MAX_AGE_DAYS:-3}"
RUNTIME="$HOME/Library/Application Support/Prepeat"

log() { printf '%s  [freshness] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# `giving up after` matters: without it a dialog nobody dismisses would keep a
# launchd job alive forever.
alert() {
  local msg="$1"
  osascript >/dev/null 2>&1 <<APPLESCRIPT
    display dialog "$msg" ¬
      with title "Prep+Eat backup" ¬
      with icon caution ¬
      buttons {"Later", "Back up now"} ¬
      default button "Back up now" ¬
      giving up after 300
    if button returned of result is "Back up now" then
      do shell script "'$RUNTIME/backup-supabase.sh' > /dev/null 2>&1 &"
    end if
APPLESCRIPT
  # A banner as well, in case the dialog is dismissed without being read.
  osascript -e "display notification \"$msg\" with title \"Prep+Eat backup\"" >/dev/null 2>&1
}

NEWEST="$(ls -1t "$DEST"/prepeat-*.tar.gz 2>/dev/null | head -1)"

# --- no backups at all ------------------------------------------------------

if [ -z "$NEWEST" ]; then
  log "NO BACKUPS FOUND in $DEST"
  alert "No Prep+Eat database backup can be found at all. The nightly backup is not working."
  exit 1
fi

# --- how old is the newest one ----------------------------------------------

NOW=$(date +%s)
MTIME=$(stat -f %m "$NEWEST" 2>/dev/null || echo 0)
AGE_DAYS=$(( (NOW - MTIME) / 86400 ))

if [ "$AGE_DAYS" -gt "$MAX_AGE_DAYS" ]; then
  log "STALE: newest backup is $AGE_DAYS days old ($(basename "$NEWEST"))"
  if [ "$AGE_DAYS" -ge 14 ]; then
    detail="That is long enough that something is probably broken rather than just a Mac that has been off."
  else
    detail="If the Mac has simply been off, backing up now clears it."
  fi
  alert "The last Prep+Eat database backup is $AGE_DAYS days old. $detail"
  exit 1
fi

# --- did the most recent run actually succeed -------------------------------
# The archive can be fresh while the run that wrote it still reported trouble -
# a failed photo mirror, for instance.
#
# ONLY THE LAST RUN IS EXAMINED, never the whole file. The log is appended to
# forever, so grepping all of it would mean a single bad night in March makes
# this alarm fire every day thereafter - and an alarm that cries wolf
# permanently is worse than no alarm, because it teaches you to ignore it.
# Runs are delimited by the "backing up to" line the backup script opens with.

LOGFILE="$DEST/backup.log"
LAST_RUN=""
if [ -f "$LOGFILE" ]; then
  LAST_RUN="$(awk '/backing up to/{buf=""} {buf = buf $0 "\n"} END{printf "%s", buf}' "$LOGFILE" 2>/dev/null)"
fi

if [ -n "$LAST_RUN" ] && printf '%s' "$LAST_RUN" | grep -q "FAILED"; then
  log "last run reported FAILED"
  alert "The last Prep+Eat backup run reported an error. The most recent good backup is $AGE_DAYS day(s) old."
  exit 1
fi

log "OK: newest backup is $AGE_DAYS day(s) old ($(basename "$NEWEST"))"
exit 0
