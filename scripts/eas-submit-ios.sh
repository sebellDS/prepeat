#!/bin/zsh
# Ship the most recent finished EAS build to TestFlight. No rebuild.
#
# Usage: ./scripts/eas-submit-ios.sh
#
# Run this AFTER ./scripts/eas-build-ios.sh has finished. It uploads the
# latest build; the .ipa already exists, so this is just the upload.
#
# WATCHDOG (2026-07-23): the actual upload runs on Expo's servers and the
# command only watches. Once, that server-side submission wedged and the
# command sat on "Submitting" for 90 minutes with no error. So this script
# caps the wait: if the submit prints nothing for STALL_LIMIT seconds the local
# watcher is killed rather than hanging forever.
#
# WHAT A WATCHDOG KILL DOES NOT MEAN (2026-08-04, build 15): that nothing
# shipped. The submission had not even started uploading – it was IN QUEUE on
# Expo's servers, which is silent, so ten minutes of no output was normal. This
# script used to print "Nothing shipped" there, which is not knowable from this
# end. It now prints what `eas submit:list` and Apple actually say, because the
# right next move differs completely: "in queue" means wait, "errored" means
# retry. Retrying a queued submission only adds a duplicate.
#
# The run then ends by asking App Store Connect directly whether the build is
# VALID (scripts/asc-build-state.mjs) – added 2026-07-25 after `eas submit`
# was seen spinning long AFTER a successful upload as well as during a stuck
# one. Apple's answer is the only trustworthy one.

set -e

cd "$(dirname "$0")/.."
source scripts/eas-env.sh

STALL_LIMIT=600   # seconds with no new output before we call it hung (10 min)
LOG=$(mktemp)

echo "==> Uploading the latest build to TestFlight"

# Run the submit in the background, streaming its output to both the screen
# and a log file whose modification time we can watch.
npx eas-cli submit --platform ios --profile production --latest --non-interactive \
  2>&1 | tee "$LOG" &
SUBMIT_PID=$!

# Watchdog: if the log stops growing for STALL_LIMIT seconds, kill the submit.
(
  while kill -0 $SUBMIT_PID 2>/dev/null; do
    sleep 30
    LAST=$(stat -f %m "$LOG")
    NOW=$(date +%s)
    if (( NOW - LAST > STALL_LIMIT )); then
      echo ""
      echo "==> No output for ${STALL_LIMIT}s, so the local watcher is being"
      echo "    killed. That says NOTHING about the submission itself: the"
      echo "    upload runs on Expo's servers and carries on without us."
      echo "    The state is checked below – do not retry before reading it."
      # Kill the whole pipeline (eas-cli + tee).
      pkill -P $SUBMIT_PID 2>/dev/null
      kill $SUBMIT_PID 2>/dev/null
      exit 0
    fi
  done
) &
WATCHDOG_PID=$!

# Wait for the submit; capture its status, then stop the watchdog.
wait $SUBMIT_PID
STATUS=$?
kill $WATCHDOG_PID 2>/dev/null

rm -f "$LOG"

if (( STATUS != 0 )); then
  # It used to say "Nothing shipped" here, which is not knowable from this end
  # and was wrong the first time it mattered (2026-08-04, build 15): the local
  # watcher had been killed by the watchdog while Expo's submission sat happily
  # IN QUEUE, and a retry would only have added a second one for the same build.
  # So report what the servers actually say instead of guessing.
  echo ""
  echo "==> The local watcher stopped (exit $STATUS). What the SERVERS say:"
  npx eas-cli submit:list --limit 1 2>/dev/null |
    grep -E "^(Status|Build number|Submission Details)" || true
  echo ""
  echo "    in queue / in progress -> it is still going. Wait, do NOT retry;"
  echo "                              a retry just queues a duplicate."
  echo "    finished               -> it worked. Apple is processing it."
  echo "    errored                -> THIS is the one to retry."
  echo ""
  echo "==> Asking Apple as well, since that is the only real done-signal:"
  node scripts/asc-build-state.mjs || true
  exit $STATUS
fi

echo "==> Uploaded. Waiting for Apple to finish processing it."
echo "    (The CLI's success message is not proof – it has spun long after a"
echo "     successful upload AND during a stuck one. Apple's own answer is.)"

# The real done-signal: the build showing VALID in App Store Connect.
node scripts/asc-build-state.mjs --wait 20
