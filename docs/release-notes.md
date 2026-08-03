# Prep+Eat release notes

What shipped in each build, in the App Store's "What's New" voice, so there
is always something ready to post. Started 2026-08-03 – earlier builds are
reconstructed from the backlog and git history.

> **IN REVIEW: 1.0.0** (build 12) · **NEXT VERSION: 1.1.0** · `app.json` still
> says 1.0.0, correctly – it is bumped at submission, not now.
>
> Thomas does not track the number; keeping these two lines true is Claude's
> job (agreed 2026-08-03). The rule below decides the next number, so this is
> bookkeeping, not a judgement: re-read it whenever a change is added under
> "Accumulating", and raise it if what landed outranks it – a feature turns a
> pending 1.0.1 into 1.1.0, and it never goes back down within one release.

## Versioning – Semantic Versioning (Thomas, 2026-08-03)

`MAJOR.MINOR.PATCH`, in `app.json`'s `expo.version`. Semver was written for
libraries, where MAJOR means "I broke your code" – an app has no callers to
break, so the digits are defined here in the app's own terms, otherwise the
rule decides nothing:

- **PATCH** (1.0.0 → 1.0.1) – fixes and polish. Nothing new to do, nothing
  moved. A user who never reads notes should not notice anything except that
  something stopped being broken.
- **MINOR** (1.0.1 → 1.1.0) – a new capability. Anything that would be worth a
  sentence in the App Store notes because the user can now do something they
  could not before.
- **MAJOR** (1.x → 2.0.0) – a release existing users have to re-learn: a
  redesign, a change to what the app is for, a paid tier. Rare, and a
  deliberate decision rather than a consequence of a big diff.

The version is NOT the build number. EAS auto-increments builds (12, 13, …)
and many builds can sit under one version – build 12 and build 13 are both
"1.0.0". Only bump `expo.version` when preparing a release to submit; Apple
requires it to increase between releases, not between builds.

**A migration has no version.** It is live for every version at once the
moment it runs, so it can never appear in a version's notes. That is why
server changes have their own section at the bottom of this file.

Two more rules this file exists to keep straight:

1. **A build is not a release.** A build reaching TestFlight is not a build
   users have. v1.0 in App Store review is bound to build 12 and nothing
   shipped since then is in it.
2. **Database changes are not in any build.** Migrations reach every phone
   the moment they run, whatever version it is on. They are listed
   separately below for that reason.

---

## Accumulating toward the next version

More is going in before this ships, so this section grows. On the dev build
only: not on TestFlight, not in review, and it needs a build to reach anyone.

**This will be 1.1.0** under the rule above – not a choice, just what the rule
says: it carries a new capability (moving leftovers between weeks) alongside
the fixes, and a feature makes it MINOR. It stays unnumbered in `app.json`
until it is actually being prepared for submission, and v1.0.0 has to be
approved and released first either way.

Build 13's fixes below were briefly logged as a "1.0.1" when they were the
only thing waiting. They go out with this instead.

- **Move last week's leftovers to this week.** A past week's shopping list
  that still has unchecked items gets a "Move all items to this week"
  button. Items that were not bought move onto the current week instead of
  being re-added by hand, merging into anything already there rather than
  making a second line. Undo puts both weeks back.
- The shopping list checkbox sits level with the item name again, instead of
  drifting into the gap under it on rows with an amount.

## Build 13 – TestFlight 2026-08-03 (VALID, not in review)

**These are NOT in v1.0.** v1.0 was deliberately left bound to build 12
rather than disturb the review queue, so they need a 1.0.1 once v1.0 is
approved and released.

- An imported recipe is no longer lost when its photo cannot be fetched, and
  a save that fails now says so instead of failing quietly.
- "Try again" where loading could fail: the Recipes tab, recipe detail and
  the shopping week switch. Shopping also gained a loading spinner it never
  had, so switching week no longer looks like nothing happened.
- The household invite code is legible (it failed contrast before).

## Build 12 – TestFlight 2026-07-30, **submitted for App Store review 2026-07-31**

This is v1.0 – the version in review, and the only one the public will get
at launch.

- The Plan tab recovers from a failed load instead of sitting empty.
- The household switcher is obvious, and you can create a new household from
  it.
- Recipe import handles fraction ranges, dangling clauses and "1 cups".
- A recipe with no ingredients is no longer imported as an empty shell.
- Five small UI fixes across household, recipes and shopping.

---

## Server changes (live for everyone, no build needed)

- **2026-08-03 – migration 0026.** Adds the move/undo functions the leftover
  move calls. Live, but unreachable until the app half ships, so no phone
  behaves differently yet.
- **2026-08-03 – migration 0025.** A shopping line can no longer be debited
  more than it was credited: checking an item off around a plan change used
  to leave its amount wrong. **Live for everyone including v1.0's build 12.**
