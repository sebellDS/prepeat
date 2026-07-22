#!/bin/zsh
# Cloud-build the iOS app on EAS and (optionally) ship it to TestFlight.
#
# Usage: ./scripts/eas-build-ios.sh              build only
#        ./scripts/eas-build-ios.sh --submit     build, then upload to TestFlight
#
# Apple authentication goes through the App Store Connect API key in
# credentials/ (gitignored), NOT through an Apple ID login – so no SMS 2FA
# code is needed and Claude can run this unattended.
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

KEY_FILE=(credentials/AuthKey_*.p8)
if [[ ! -f "${KEY_FILE[1]}" ]]; then
  echo "ERROR: no App Store Connect API key found in credentials/"
  echo "Expected a file named AuthKey_<KEYID>.p8 – download it from"
  echo "App Store Connect -> Users and Access -> Integrations."
  exit 1
fi

# The key id is the middle of the filename: AuthKey_UN3YR958DC.p8 -> UN3YR958DC
KEY_ID="${${KEY_FILE[1]:t:r}#AuthKey_}"

export EXPO_ASC_API_KEY_PATH="${KEY_FILE[1]}"
export EXPO_ASC_KEY_ID="$KEY_ID"
export EXPO_ASC_ISSUER_ID="5ba3a44b-c5b2-4447-8120-72fb441faa08"
export EXPO_APPLE_TEAM_ID="Z58TG8X9KB"
export EAS_BUILD_NO_EXPO_GO_WARNING=true

echo "==> Using App Store Connect key $KEY_ID"
echo "==> Building iOS (production profile) on EAS – this takes 15-25 min"

npx eas-cli build --platform ios --profile production

if [[ "$1" == "--submit" ]]; then
  echo "==> Uploading the finished build to TestFlight"
  npx eas-cli submit --platform ios --profile production --latest
fi
