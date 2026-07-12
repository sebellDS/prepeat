#!/bin/zsh
# Build + install the Release app on an iPhone, with visible progress and
# a clean exit when done (the raw `expo run:ios` never exits – it keeps
# streaming device logs, which reads as a hung build).
#
# Usage: ./scripts/build-iphone.sh            (Thomas's iPhone)
#        ./scripts/build-iphone.sh <UDID>     (another device)
#
# The phone must be cabled and unlocked. Free-team signing expires after
# 7 days – this same command is the weekly refresh.
set -e
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:$PATH

UDID=${1:-00008130-000C28221489001C}

echo "[build-iphone] $(date +%H:%M:%S) checking the device is visible…"
if ! xcrun xctrace list devices 2>/dev/null | grep -q "$UDID"; then
  echo "[build-iphone] Device $UDID not found – cable and unlock the phone." >&2
  exit 1
fi

echo "[build-iphone] $(date +%H:%M:%S) building (Release, ~5 min first time)…"
# --no-bundler: Release builds embed the JS bundle, so Metro is never
# needed – and without it the CLI exits after install instead of tailing.
npx expo run:ios --configuration Release --no-bundler --device "$UDID"

echo "[build-iphone] $(date +%H:%M:%S) done – app installed."
