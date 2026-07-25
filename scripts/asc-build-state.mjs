// Ask App Store Connect what it ACTUALLY has, instead of trusting eas-cli.
//
// Why this exists (2026-07-23, again 2026-07-25): `eas submit` is unreliable in
// BOTH directions – it can spin on "Submitting" forever when the server-side
// upload is stuck, AND keep spinning long after the upload succeeded. The only
// trustworthy done-signal is Apple's own: the build showing processingState
// VALID. The submit script calls this at the end so a run finishes with a fact
// rather than a hopeful message.
//
// Usage (config comes from scripts/eas-env.sh):
//   node scripts/asc-build-state.mjs              # print the latest builds
//   node scripts/asc-build-state.mjs --wait 10    # poll until VALID, max 10 min
//
// Exit 0 when the newest build is VALID (or when just listing), 1 otherwise.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const KEY_PATH = process.env.EXPO_ASC_API_KEY_PATH;
const KEY_ID = process.env.EXPO_ASC_KEY_ID;
const ISSUER = process.env.EXPO_ASC_ISSUER_ID;
// The app record: "Prep+Eat", bundle app.prepeat.
const APP_ID = '6793690543';

if (!KEY_PATH || !KEY_ID || !ISSUER) {
  console.error(
    'ERROR: missing App Store Connect config. Source scripts/eas-env.sh first.',
  );
  process.exit(1);
}

const waitFlag = process.argv.indexOf('--wait');
const waitMinutes = waitFlag === -1 ? 0 : Number(process.argv[waitFlag + 1] ?? 15);

const b64url = (input) =>
  Buffer.from(typeof input === 'string' ? input : JSON.stringify(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/**
 * ES256 JWT for the ASC API. The signature must be raw r||s (JOSE), which is
 * what dsaEncoding 'ieee-p1363' produces – node's default DER is rejected.
 */
function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const payload = b64url({
    iss: ISSUER,
    iat: now,
    exp: now + 600,
    aud: 'appstoreconnect-v1',
  });
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer
    .sign({ key: readFileSync(KEY_PATH, 'utf8'), dsaEncoding: 'ieee-p1363' })
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.${signature}`;
}

async function latestBuilds() {
  const res = await fetch(
    `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP_ID}&limit=5&sort=-version`,
    { headers: { Authorization: `Bearer ${token()}` } },
  );
  if (!res.ok) {
    throw new Error(`App Store Connect ${res.status}: ${await res.text()}`);
  }
  const { data } = await res.json();
  return data.map((b) => ({
    number: b.attributes.version,
    state: b.attributes.processingState,
    uploaded: b.attributes.uploadedDate,
  }));
}

function print(builds) {
  for (const b of builds) {
    console.log(
      `  build ${String(b.number).padStart(3)}  ${b.state.padEnd(10)}  uploaded ${b.uploaded}`,
    );
  }
}

const deadline = Date.now() + waitMinutes * 60_000;
let builds = [];
do {
  try {
    builds = await latestBuilds();
  } catch (error) {
    // A transient API blip should not fail the whole submit – keep polling.
    console.warn(`  (could not reach App Store Connect: ${error.message})`);
  }
  const newest = builds[0];
  if (newest?.state === 'VALID') {
    console.log(`==> Build ${newest.number} is VALID on TestFlight.`);
    print(builds);
    process.exit(0);
  }
  if (waitMinutes > 0 && Date.now() < deadline) {
    if (newest) {
      console.log(`  build ${newest.number}: ${newest.state} – waiting…`);
    } else {
      console.log('  not in App Store Connect yet – waiting…');
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
} while (Date.now() < deadline);

if (waitMinutes === 0) {
  print(builds);
  process.exit(0);
}

console.log(
  `==> Not VALID after ${waitMinutes} min. Apple is usually 5-15; check`,
);
console.log('    https://appstoreconnect.apple.com/apps/6793690543/testflight/ios');
print(builds);
process.exit(1);
