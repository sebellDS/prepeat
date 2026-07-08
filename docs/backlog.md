# Prep+Eat backlog

The working to-do list for the project. Scope and decisions live in
[projektgrundlag.md](projektgrundlag.md) – this file is about what happens
next and in which order. Checked items move to git history; ideas graduate
upward when we commit to them.

Ordering principle (agreed 2026-07-08): things that stand on their own and
deliver value by themselves come before things that depend on them – and
when a milestone finishes, the order gets a fresh look before starting the
next one.

## Next milestone: recipes

Chosen ahead of the weekly plan (2026-07-08): the planner's core
interaction is picking a recipe, the plan→shopping-list magic needs recipe
ingredients to snapshot, and recipes are useful on their own from day one –
the family can start collecting favourites immediately.

- [ ] Design: recipes screens – list, detail, create/edit with ingredients
      (Thomas, in Figma). The create/edit ingredient rows should carry
      name + quantity + unit, since these snapshot to the shopping list
- [ ] Build: recipes tables (household-owned, created_by attribution,
      copy-on-leave per projektgrundlag) + screens from the designs
- [ ] URL import (schema.org with manual fallback) – deliberately its own
      step after manual recipes work; the most technical piece

## Then: the weekly plan

- [ ] Design: weekly plan screen (Plan tab) – Monday start, up to four meal
      slots/day, visible servings control; decide whether meals without a
      recipe ("Leftovers", "Eating out") are allowed (recommended – needs a
      small data-model change)
- [ ] Parked question, becomes urgent here: how do new plan items reach a
      non-empty shopping list mid-week? ("Fill from weekly plan" exists
      only on the empty state today)
- [ ] Build: meal plan tables + screen, ingredient snapshots into the
      shopping list, realtime like the shopping list

## In parallel – when it fits

- [ ] Apple Developer account ($99/year) + TestFlight so the family can
      install without cables (also ends the 7-day rebuild ritual on both
      phones)
- [ ] "Continue with Apple" button once the paid developer account exists
- [ ] Re-export the splash photo at 3x someday – Thomas's reframed copy
      (2026-07-07) is 402px wide (1x), soft on a Retina screen
- [ ] Resend-code feedback states ("Sending…" / "New code sent" / retry)
      are improvised in code – design them if they should look different
      (2026-07-08)

## Decisions log (recent)

- Recipes before the weekly plan (2026-07-08, Thomas's catch): build the
  dependency first; the backlog gets re-ordered at each milestone boundary.
- Checked items clear two ways (decided 2026-07-07): a manual "Clear" button
  in the done section, plus an automatic sweep when the list is filled from
  the weekly plan. No time-based auto-clear. Cleared items are soft-deleted,
  so undo/history stays possible.
- Checked items move to the done section after 0.2s with a fade/slide
  animation (tuned down from 1.5s via 0.6s and 0.4s; 0.2s felt right,
  2026-07-08). Accidental taps are undone from the done section instead
  of a linger window.

## Code debts (small, known, deliberate)

- [ ] Onboarding error banners show raw technical messages ("fetch failed:
      The network connection was lost.") – translate the common cases
      (offline, wrong code, expired code) to plain language (2026-07-08)
- [ ] Delete an item has no undo – soft delete is wired to the database now
      (migration 0005), so a "Deleted · Undo" toast just needs to clear
      deleted_at
- [ ] "Fill from weekly plan" loads sample data until the Plan tab exists

## Ideas – not yet committed

- [ ] **Per-store category layouts** (Thomas, 2026-07-06): save the category
      order per named store ("Netto", "Bilka"…), so entering a store sorts
      the list to that store's layout. Simple version: pick the store when
      you start shopping. Stretch: auto-switch by location. Needs a small
      `store_layouts` table (household_id, name, category_order) on top of
      the existing single order.
- [ ] AI first-guess for categories, in front of the learned memory
      (decision #7 names this as the natural v1.1 upgrade)
- [ ] Smart quantity parsing when adding items ("Milk 2L" → name + quantity)

## Recurring

- [ ] Rebuild the app on both family iPhones every ~7 days (free-signing
      expiry, both clocks reset 2026-07-08) until TestFlight takes over

## Pre-launch checklist (v1 ship)

- [ ] Proper trademark search for "Prepeat" / "Prep+Eat"
- [ ] App Store assets: icon, screenshots, description
- [ ] Privacy policy (required for accounts + a database)
