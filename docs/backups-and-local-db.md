# Backups and the local database

Written 2026-08-04. The *why* lives in the backlog decisions log; this file is
the **what and where** – what is installed on the Mac, what runs when, and what
to actually do when something goes wrong.

If you are reading this cold: the app's database lives on Supabase and is
shared by every installed build at once. The Free plan takes **no automatic
backups**, so everything below exists to make sure a copy exists anyway.

---

## The short version

| I want to… | Command |
|---|---|
| Back up right now | `npm run backup` |
| Check a backup can be restored | `npm run backup:verify` |
| Test migrations before production | `npm run db:reset` |
| Start / stop the local database | `npm run db:start` / `npm run db:stop` |
| Re-install the scheduled jobs | `npm run backup:install` |

**Docker only needs to run for the middle three.** Backups do not use it.

---

## What runs automatically

Two background jobs, both installed by `npm run backup:install`.

**`dk.sebell.prepeat.backup` – 03:15 nightly**
Dumps the database and mirrors the recipe photos into `~/Prepeat-backups`.
Keeps 30 nights.

**`dk.sebell.prepeat.backup-check` – at login, and 10:00 daily**
Shows a warning dialog if the newest backup is more than 3 days old, if there
is none at all, or if the last run failed. The dialog has a **Back up now**
button.

### The lid-closed question

A sleeping Mac runs nothing. launchd does the missed run **once on the next
wake**, so a closed lid delays the backup, it never skips it. Shut for a week
means a week with no backup – and the freshness alarm will say so when you open
it. Nothing wakes the Mac for this on purpose (it would wake the machine in
your bag).

---

## Where everything lives

| What | Where | In git? |
|---|---|---|
| The scripts (source of truth) | `scripts/` in this repo | yes |
| The copies that actually run | `~/Library/Application Support/Prepeat/` | no |
| Schedules | `~/Library/LaunchAgents/dk.sebell.prepeat.*.plist` | no, generated |
| Backups and log | `~/Prepeat-backups/` | no |
| Database password | `~/.prepeat-backup.env` (mode 600) | **never** |

### ⚠️ Two traps

**Editing `scripts/backup-supabase.sh` changes nothing until you run
`npm run backup:install`.** The job runs the installed copy, not the repo one.

**Why a copy at all:** macOS privacy protection stops a background job reading
anything in `~/Documents`. The first scheduled run failed with *Operation not
permitted* even though the same script worked by hand. Anything scheduled must
live outside `~/Documents`.

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
6. `launchctl kickstart -k gui/$(id -u)/dk.sebell.prepeat.backup` – and read the
   exit code. **A scheduled job is not installed until it has been seen
   succeeding on the scheduler**; running the script yourself proves nothing.

---

## Restoring for real

The rehearsal (`npm run backup:verify`) runs exactly this against the local
database, which is what keeps the procedure honest. For a real recovery into a
new Supabase project:

1. Create the project. **Postgres 17** – it must match production.
2. Unpack the archive: `tar -xzf ~/Prepeat-backups/prepeat-YYYY-MM-DD-HHMM.tar.gz`
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
And the `drop schema public` is required because the dump opens with
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

---

## When to stop relying on this

The local backup is real coverage – nightly, 30 days, and proven to restore.
Its two weaknesses are that it needs the Mac switched on, and it is one copy in
one building. See the **pre-launch checklist** for the three triggers that mean
it is time to pay for Supabase Pro.
