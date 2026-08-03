#!/bin/zsh
# Build + install the Release app on an iPhone, with visible progress and
# a clean exit when done.
#
# Usage: ./scripts/build-iphone.sh            (Thomas's iPhone)
#        ./scripts/build-iphone.sh <UDID>     (another device)
#
# The phone must be reachable and unlocked: a cable always works, but a
# paired phone on the same Wi-Fi also installs wirelessly via devicectl
# (observed 2026-07-18) – cable is the fallback when "device not found".
# Free-team signing expires after
# 7 days. This script RENEWS that window on every run: a plain rebuild
# reuses the still-valid profile and does NOT reset the clock (learned the
# hard way 2026-07-15, both phones died mid-day), so we delete the app's
# provisioning profile first, then build with `xcodebuild
# -allowProvisioningUpdates` (which mints a fresh profile) and install the
# result with `devicectl`. NOTE: `expo run:ios` does NOT pass that flag, so
# once the profile is deleted it can't sign – that is why we drive
# xcodebuild directly (confirmed 2026-07-16). The new expiry is printed at
# the end; if it ever comes back less than ~7 days out, the free
# development certificate (also 7-day) is the limiter and needs
# regenerating too.
set -e
export LANG=en_US.UTF-8
export PATH=/opt/homebrew/bin:$PATH
# Direct-to-device builds are the "dev" variant: own bundle id, name and icon
# (app.config.js), so they install ALONGSIDE the TestFlight app instead of
# overwriting it. TestFlight/App Store builds go through EAS production, which
# leaves APP_VARIANT unset and keeps the real Prep+Eat identity.
export APP_VARIANT=dev

SCRIPT_DIR=${0:A:h}
PROJECT_DIR="$SCRIPT_DIR/.."
WORKSPACE="$PROJECT_DIR/ios/PrepEat.xcworkspace"
UDID=${1:-00008130-000C28221489001C}
BUNDLE_ID=app.prepeat.dev
# Xcode 16 keeps profiles under UserData; older Xcodes used MobileDevice.
# Check both so this keeps working across upgrades / machines.
PROFILE_DIRS=(
  "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
  "$HOME/Library/MobileDevice/Provisioning Profiles"
)

# Echo the paths of installed provisioning profiles that sign this app.
prepeat_profiles() {
  for dir in "${PROFILE_DIRS[@]}"; do
    [ -d "$dir" ] || continue
    for p in "$dir"/*.mobileprovision(N); do
      if security cms -D -i "$p" 2>/dev/null | grep -q "$BUNDLE_ID"; then
        print -- "$p"
      fi
    done
  done
  return 0
}

echo "[build-iphone] $(date +%H:%M:%S) checking the device is visible…"
if ! xcrun xctrace list devices 2>/dev/null | grep -q "$UDID"; then
  echo "[build-iphone] Device $UDID not found – cable and unlock the phone." >&2
  exit 1
fi

# PAIRED IS NOT REACHABLE. The check above only asks whether Xcode KNOWS this
# phone, so an unplugged, sleeping or off-network handset sails through it and
# xcodebuild then dies with "Unable to find a destination matching…" followed
# by a wall of simulator names – which reads like a broken build rather than an
# unplugged phone (wasted a round on 2026-08-03). devicectl reports the real
# state: an unreachable device is "unavailable", while "disconnected" is the
# normal resting state of a phone that IS reachable (it opens the tunnel on
# demand). Only "unavailable" is worth refusing on.
DEV_JSON="$(mktemp -t prepeat-devices)"
if xcrun devicectl list devices --json-output "$DEV_JSON" >/dev/null 2>&1; then
  TUNNEL_STATE="$(python3 -c '
import json, sys
try:
    devices = json.load(open(sys.argv[1]))["result"]["devices"]
except Exception:
    devices = []
for d in devices:
    if d.get("hardwareProperties", {}).get("udid") == sys.argv[2]:
        print(d.get("connectionProperties", {}).get("tunnelState", ""))
        break
' "$DEV_JSON" "$UDID" 2>/dev/null)"
  rm -f "$DEV_JSON"
  if [ "$TUNNEL_STATE" = "unavailable" ]; then
    echo "[build-iphone] The iPhone is paired but NOT reachable right now." >&2
    echo "[build-iphone] Unlock it and plug in the cable (or put it on the same" >&2
    echo "[build-iphone] Wi-Fi as this Mac), then run this again." >&2
    exit 1
  fi
else
  rm -f "$DEV_JSON"
fi

echo "[build-iphone] $(date +%H:%M:%S) syncing the dev app config (dev icon + app.prepeat.dev)…"
# Regenerate the native project from app.config.js so the dev icon and bundle
# id are actually baked in. The direct build compiles the existing ios/ folder
# and never re-runs prebuild on its own, so without this the icon/id drift from
# the config (that is exactly why direct builds used to show the Expo icon).
( cd "$PROJECT_DIR" && npx expo prebuild -p ios >/dev/null )

echo "[build-iphone] $(date +%H:%M:%S) renewing signing (removing the stale profile so a fresh 7-day one is minted)…"
prepeat_profiles | while read -r p; do
  echo "  removing $(basename "$p")"
  rm -f "$p"
done

echo "[build-iphone] $(date +%H:%M:%S) building (Release, ~5 min first time)…"
# xcodebuild (not expo run:ios) so -allowProvisioningUpdates is passed and a
# fresh profile is minted for the deleted one. Same workspace path as expo,
# so the DerivedData cache is shared and rebuilds stay incremental. The
# Release "Bundle React Native code and images" phase embeds the JS bundle
# (NODE_BINARY is pinned in ios/.xcode.env.local), so no separate Metro run.
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme PrepEat \
  -configuration Release \
  -destination "id=$UDID" \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  build

echo "[build-iphone] $(date +%H:%M:%S) installing on the device…"
APP=$(ls -dt "$HOME/Library/Developer/Xcode/DerivedData/PrepEat-"*/Build/Products/Release-iphoneos/PrepEat.app(N) | head -1)
if [ -z "$APP" ]; then
  echo "[build-iphone] Build finished but the .app could not be located." >&2
  exit 1
fi
xcrun devicectl device install app --device "$UDID" "$APP"

echo "[build-iphone] $(date +%H:%M:%S) done – app installed."

# Show the renewed expiry so the refresh is verifiable at a glance.
NEW_PROFILE=$(prepeat_profiles | head -1)
if [ -n "$NEW_PROFILE" ]; then
  security cms -D -i "$NEW_PROFILE" -o /tmp/prepeat_pp.plist 2>/dev/null || true
  EXPIRY=$(/usr/libexec/PlistBuddy -c "Print :ExpirationDate" /tmp/prepeat_pp.plist 2>/dev/null || true)
  rm -f /tmp/prepeat_pp.plist
  [ -n "$EXPIRY" ] && echo "[build-iphone] signing now valid until: $EXPIRY (re-trust on the phone if prompted)"
fi
