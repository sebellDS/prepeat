# Backups and the local database

Written 2026-08-04. The *why* lives in the backlog decisions log; this file is
the **what and where** – what is installed on the Mac, what runs when, and what
to do when something goes wrong.

The app's database lives on Supabase and is shared by every installed build at
once. The Free plan takes **no automatic backups**, so everything below exists
to make sure a copy exists anyway.

---

## The short version

| I want to… | Command |
|---|---|
| Back up right now | `npm run backup` |
| Check a backup can be restored | `npm run backup:verify` |
| Test migrations before production | `npm run db:reset` |
| Start / stop the local database | `npm run db:start` / `npm run db:stop` |
| Re-install the scheduled job | `npm run backup:install` |

**Docker is only needed for the middle three.** Backups do not use it, so quit
Docker whenever you like.

In practice all of these are Claude's to run during a session, not Thomas's.
The only one worth remembering unaided is `npm run backup`.

---

## What runs automatically

**One** background job, `dk.sebell.prepeat.backup`, installed by
`npm run backup:install`.

- Runs **at login, then every 6 hours** while the Mac is on.
- Does nothing unless the newest backup is **over 12 hours old**.
- Keeps 30 archives. Mirrors the recipe photos, fetching only what changed.
- If it fails **and** the newest backup is over 3 days old, it shows a warning
  dialog with a **Try again now** button.

There is no fixed hour, and deliberately so: a laptop is not a server, and
asking it to be awake at 03:15 was the wrong shape. Close the lid for a week
and it catches up by itself at the next login.

### Things this design knowingly does not cover

- **If the job itself is removed**, nothing notices. That was the price of
  halving the moving parts (it used to be two scripts and two jobs).
- **The backup is on this Mac only.** See "Getting a copy off the Mac" below.
- **The Mac has to be switched on sometimes.** Not at any particular hour.

---

## Where everything lives

| What | Where | In git? |
|---|---|---|
| The scripts (source of truth) | `scripts/` in this repo | yes |
| The copy that actually runs | `~/Library/Application Support/Prepeat/` | no |
| Schedule | `~/Library/LaunchAgents/dk.sebell.prepeat.backup.plist` | no, generated |
| Backups | `~/Prepeat-backups/` | no |
| Log | `~/Library/Logs/prepeat-backup.log` | no |
| Database password | `~/.prepeat-backup.env` (mode 600) | **never** |

### ⚠️ The one trap

**Editing `scripts/backup-supabase.sh` changes nothing until you run
`npm run backup:install`.** The job runs the installed copy, not the repo one.

**Why a copy at all:** macOS privacy protection stops a background job reading
anything in `~/Documents`. The first scheduled run failed with *Operation not
permitted* even though the same script worked by hand. Anything scheduled must
live outside `~/Documents`.

---

## Getting a copy off the Mac

There isn't one today, and it is the weakest point of this arrangement.

**iCloud Drive does not work** – tried and rejected on 2026-08-04. A launchd
job gets partial, unreliable access there: it wrote the database archive, was
refused on all 267 photos with *Operation not permitted*, and could not read
the folder it had just written, so it re-fetched everything every run. Worse
than useless, because it looks like it is working.

The two options that do work:

- **Time Machine to an external drive.** Not configured today (`tmutil
  destinationinfo` says no destinations). Covers the whole Mac, not just this.
- **Supabase Pro, $25/month.** Daily backups on their infrastructure, in
  another building, whether the Mac is on or not. See the pre-launch checklist
  for the triggers that mean it is time.

---

## Installed on this Mac

Not in the repo, so it has to be written down:

- **`libpq`** (Homebrew) – gives `pg_dump` and `psql` at
  `/opt/homebrew/opt/libpq/bin`. Keg-only, so not on `PATH`; the scripts use the
  full path. `brew install libpq`
- **Docker Desktop** – only for local Supabase. `brew install --cask docker-desktop`
- **`supabase` CLI** – an npm devDependency, not a global install, so the version
  is pinned in `package.json`. Run it as `npx supabase`.
  (The Homebrew tap install crashed; npm is the supported alternative.)
- **node via nvm** – `~/.nvm/versions/node/v20.20.2/bin`. Not needed by the
  backup, which is why a node upgrade cannot break it.

---

## ⏳ Leaving the company Mac

**This Mac belongs to Thomas's employer** (told 2026-08-04, while applying for
a new job). So it is not a question of *if* the machine goes – it is *when*,
on a date that will eventually be known. Everything below has that deadline
attached. Audited 2026-08-04.

### Travels by itself – no action

All four accounts are personal, tied to Thomas's own email, so they follow him:
**GitHub** (`thomassebell`), **Apple Developer**, **Supabase**, **Expo/EAS**.
So do the three repos – `prepeat`, `prepeat-web`, `design-system` – provided
everything is pushed. The Apple signing key is already in Apple Passwords,
synced to a personal Apple ID.

### Must be copied off before the Mac goes back

| What | Where | Notes |
|---|---|---|
| `~/Prepeat-backups/` | 58 MB | Every archive and all 267 photos. Nothing else holds these. |
| `app-store-assets/` | 10 MB | Store screenshots. Gitignored on purpose – they show real household data. |
| `~/.claude/projects/…/memory/` | 68 KB | Claude's working notes. Largely duplicated in this repo; see below. |
| `.env` | tiny | Re-derivable from the Supabase dashboard, but faster to copy. |
| `~/.prepeat-backup.env` | tiny | Or just reset the database password on the new machine. |

### Regenerates itself – ignore

`~/Library/Application Support/Prepeat/`, the LaunchAgent plist and
`~/Library/Logs/prepeat-backup.log` are all recreated by
`npm run backup:install`. The **Apple Development certificate** in the login
keychain (`sebell@mac.com`, VQ829655TW) and the two provisioning profiles are
free to regenerate from Xcode. Distribution credentials are held by EAS, not
locally, so they are unaffected.

### The part worth doing early

**The backup system built on 2026-08-04 lives on a machine that will be handed
back.** That does not lose the data – production is on Supabase – but the
safety net has an expiry date, which is a different argument for **Supabase
Pro** than the one weighed and declined earlier: $25/mo buys backups that sit
nowhere near a computer somebody else owns. Worth re-weighing when the job
actually changes, not before.

**Anything important that lives only in Claude's memory is misfiled.** The fix
is not to copy the memory folder (it is not repo material – it holds a device
UDID among other things) but to move any fact that matters into this repo, so
the repo alone is enough to pick the project up cold. Thomas deferred this on
2026-08-04 ("not yet"); it should happen before the machine goes.

### ⚖️ Worth checking, and not with Claude

Prep+Eat is a commercial product built on employer-owned hardware. Some
employment contracts have IP clauses that reach further than people expect,
particularly around work done on company equipment. **This is a question for
Thomas's contract or a professional, not for an AI assistant** – noted here
only so it is not forgotten, and because it is far cheaper to check early.

---

## If the Mac were lost tomorrow

Audited 2026-08-04. Everything below is what does NOT come back from a
`git clone` – which is precisely what cannot be worked out from the repo.

| | Where it really lives | If the Mac dies |
|---|---|---|
| Code, migrations, scripts, docs | GitHub | fine |
| Design system | `thomassebell/design-system` on GitHub | fine |
| EAS build config and secrets | Expo's servers – `eas login` | fine |
| `.env` (Supabase URL + publishable key) | Supabase dashboard | 2 minutes to redo |
| `~/.prepeat-backup.env` (db password) | resettable in the dashboard | 2 minutes to redo |
| **`credentials/*.p8`** (Apple API key) | **nowhere else** | **see below** |
| **`~/Prepeat-backups/`** | **nowhere else** | **all backups gone** |
| `app-store-assets/` | nowhere else | regenerable, tedious |

### ⚠️ The Apple signing key is download-once

`credentials/AuthKey_*.p8` is issued by App Store Connect and **can only be
downloaded at the moment it is created**. It is gitignored on purpose (it
signs releases). If the Mac is lost it cannot be recovered – only revoked and
replaced, which you would discover at the moment you needed to ship a fix.

**Keep a copy in a password manager.** It is a 257-byte file and 1Password and
similar take attachments.

### ⚠️ Losing the Mac means losing every backup

Production would be unaffected, so this is not data loss on its own – but there
would be no backup at all until the new Mac ran one. It is the same off-site
gap described above, with a concrete face on it.

### Setting this up on a new Mac

1. `brew install libpq`
2. `npm install`
3. Create `~/.prepeat-backup.env` with `SUPABASE_DB_URL="postgresql://…"` –
   Supabase dashboard → Connect → Direct → **Session pooler** → URI, with the
   database password filled in. `chmod 600` it.
   (Session pooler, not Direct: direct connections are IPv6-only. Not
   Transaction pooler: it lacks the session features `pg_dump` needs.)
4. `npm run backup` – check it writes an archive
5. `npm run backup:install`
6. `launchctl kickstart -k gui/$(id -u)/dk.sebell.prepeat.backup`, then read the
   exit code. **A scheduled job is not installed until it has been seen
   succeeding on the scheduler**; running the script yourself proves nothing.
   That mistake has now been made twice – once with `~/Documents`, once with
   iCloud – and both times the manual run worked perfectly.

---

## Restoring for real

`npm run backup:verify` runs exactly this against the local database, which is
what keeps the procedure honest. For a real recovery into a new Supabase
project:

1. Create the project. **Postgres 17** – it must match production.
2. Unpack: `tar -xzf ~/Prepeat-backups/prepeat-YYYY-MM-DD-HHMM.tar.gz`
3. Against the new project's database, in this order:

   ```sql
   drop schema if exists public cascade;
   truncate storage.objects, storage.buckets cascade;
   delete from auth.users cascade;
   ```

   Then `psql "<new-project-url>" -f auth-storage-data.sql`
   followed by `psql "<new-project-url>" -f public.sql`

**The order is not optional.** The app's tables carry foreign keys into
`auth.users`, so the accounts must exist before the app data lands on them.
And `drop schema public` is required because the dump opens with
`CREATE SCHEMA "public"`, which every fresh database already has.

4. Re-upload the photos from `~/Prepeat-backups/recipe-photos/` into the
   `recipe-photos` bucket.
5. Point the app at the new project (`EXPO_PUBLIC_SUPABASE_URL` and the
   publishable key) – **this needs a new build**, so it is the slow part of any
   recovery.

### What is deliberately not in the backup

Sessions, refresh tokens, MFA claims, one-time tokens, audit logs. Everyone
signs in again after a restore, which they would have to regardless: a rebuilt
project has a new JWT secret that old tokens cannot match.
