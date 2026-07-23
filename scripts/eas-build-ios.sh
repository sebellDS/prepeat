#!/bin/zsh
# Cloud-build the iOS app on EAS. Build ONLY – it does not ship anything.
#
# Usage: ./scripts/eas-build-ios.sh
#
# When the build finishes it prints the build number. Ship it to TestFlight
# as a SEPARATE step:  ./scripts/eas-submit-ios.sh
#
# Why separate (2026-07-23): a single build+submit command hid a submit that
# hung on Expo's servers for 90 minutes – it looked like a slow build. Kept
# apart, a build is a build and a stuck submit is obvious immediately.
#
# ONE EXCEPTION, and it is why this script exists as something Thomas runs
# himself: EAS refuses to create the Apple *distribution certificate* in
# non-interactive mode (SetUpDistributionCertificate.runNonInteractiveAsync
# throws MissingCredentialsNonInteractiveError when no cert is on file – the
# API key does not help). So the FIRST run must be interactive, in a real
# terminal, and will ask:
#
#     Generate a new Apple Distribution Certificate?  -> Yes
#
# Answer Yes once. The certificate is then stored on the Expo servers and
# every later build reuses it, non-interactively. Apple caps an account at
# 2 distribution certificates, so do not generate extras – if a later run
# asks again, something is wrong; stop and check with Claude rather than
# saying Yes a second time.

set -e

cd "$(dirname "$0")/.."
source scripts/eas-env.sh

echo "==> Using App Store Connect key $KEY_ID"
echo "==> Building iOS (production profile) on EAS – this takes 15-25 min"

npx eas-cli build --platform ios --profile production

echo ""
echo "==> Build done. Ship it to TestFlight with:  ./scripts/eas-submit-ios.sh"
