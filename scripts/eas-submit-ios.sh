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
# caps the wait: if the submit prints nothing for STALL_LIMIT seconds it is
# killed and the script exits non-zero, telling you to check and retry –
# rather than hanging forever. Retrying is free: the build is unchanged and
# Apple ignores a duplicate upload of a build number it already has.
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
      echo "ERROR: submit made no progress for ${STALL_LIMIT}s – it is hung on"
      echo "Expo's servers, not your Mac. Killing it. This is safe to retry:"
      echo "just run ./scripts/eas-submit-ios.sh again."
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
  echo "==> Submit did not complete (exit $STATUS). Nothing shipped."
  exit $STATUS
fi

echo "==> Uploaded. Waiting for Apple to finish processing it."
echo "    (The CLI's success message is not proof – it has spun long after a"
echo "     successful upload AND during a stuck one. Apple's own answer is.)"

# The real done-signal: the build showing VALID in App Store Connect.
node scripts/asc-build-state.mjs --wait 20
