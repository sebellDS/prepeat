# Shared Apple auth for the EAS build + submit scripts. Sourced, not run.
#
# Authentication goes through the App Store Connect API key in credentials/
# (gitignored), NOT an Apple ID login – so no SMS 2FA code is needed and the
# build/submit can run unattended.

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
