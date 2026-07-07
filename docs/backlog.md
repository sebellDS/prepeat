# Prep+Eat backlog

The working to-do list for the project. Scope and decisions live in
[projektgrundlag.md](projektgrundlag.md) – this file is about what happens
next and in which order. Checked items move to git history; ideas graduate
upward when we commit to them.

## Next milestone: the shared list

The jump from "demo on Thomas's phone" to "the family's real shopping list".

- [x] Sign-in flow – email + one-time code (decided 2026-07-07), sessions
      never expire on a schedule, sign-out on the Household tab. Tested
      end-to-end 2026-07-07: Thomas is user #1, "Sebell Kitchen" is
      household #1
- [x] Custom SMTP via Resend (connected 2026-07-07; sender is
      onboarding@resend.dev for now)
- [x] Household onboarding: create + shareable multi-use invite code +
      join (migrations 0003 + 0004 applied)
- [x] Verify the prepeat.app domain in Resend – done 2026-07-07, codes
      now send from hello@prepeat.app to any address
- [x] Re-skin the onboarding flow from Thomas's Figma designs – splash,
      sign-in, name, household and join screens all match (2026-07-07)
- [ ] Re-export the splash photo at 3x someday – Thomas's reframed copy
      (2026-07-07) is 402px wide (1x), soft on a Retina screen
- [ ] "Continue with Apple" button once the paid developer account exists
- [x] Shopping list reads/writes Supabase instead of in-memory state
      (quantity split into numeric + unit; learned categories and category
      order migrate from device storage to the household on first launch)
      – built 2026-07-07
- [x] Migration: household category order (store-walk sorting) in Supabase
      – part of migration 0005
- [x] Realtime sync between phones; Live badge reflects the actual
      connection state (green Live / grey connecting / grey Off) – built
      2026-07-07
- [ ] Apply migration 0005 in the Supabase dashboard (Thomas, with
      click-by-click steps from Claude) – the app needs it before the new
      shopping list works
- [ ] Test the shared list on two devices once a second family member's
      phone is available (realtime, checked-by initials, category teaching)
- [ ] Apple Developer account ($99/year) + TestFlight so the family can
      install without cables

## Design – in Thomas's court

- [ ] Weekly plan screen (Plan tab) – next screen after shopping
- [ ] Recipes screens (list, detail, create/edit)
- [ ] Parked question from the shopping review: how do new plan items reach
      a non-empty shopping list mid-week? ("Fill from weekly plan" exists
      only on the empty state today)

## Code debts (small, known, deliberate)

- [ ] Delete an item has no undo – soft delete is wired to the database now
      (migration 0005), so a "Deleted · Undo" toast just needs to clear
      deleted_at
- [ ] Edit sheet grows past the top safe area when the category picker is
      open – cap its height and scroll inside
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

- [ ] Rebuild the app on Thomas's iPhone every ~7 days (free-signing expiry)
      until TestFlight takes over

## Pre-launch checklist (v1 ship)

- [ ] Proper trademark search for "Prepeat" / "Prep+Eat"
- [ ] App Store assets: icon, screenshots, description
- [ ] Privacy policy (required for accounts + a database)
