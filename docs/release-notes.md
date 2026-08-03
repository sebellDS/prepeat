# Prep+Eat release notes

What shipped in each build, in the App Store's "What's New" voice, so there
is always something ready to post. Started 2026-08-03 – earlier builds are
reconstructed from the backlog and git history.

Two rules this file exists to keep straight:

1. **A build is not a release.** A build reaching TestFlight is not a build
   users have. v1.0 in App Store review is bound to build 12 and nothing
   shipped since then is in it.
2. **Database changes are not in any build.** Migrations reach every phone
   the moment they run, whatever version it is on. They are listed
   separately below for that reason.

---

## Unreleased – on the dev build only

Not on TestFlight, not in review. Needs a build to reach anyone.

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
