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

- [x] Design: recipes screens (Thomas, 2026-07-12; reviewed, spelling and
      copy fixed in the file the same day)
- [x] Build: migration 0006 (recipes/ingredients/steps + shared favorite +
      photo storage bucket) and all screens – list with search+chips,
      detail with servings scaling and cooking check-offs, add/edit form
      with photo picking, sheets and dialogs (built 2026-07-12)
- [x] Apply migration 0006 in the Supabase dashboard (Thomas; SQL goes on
      the clipboard) – the Recipes tab needs it
- [x] Device build with expo-image-picker (new native module) + walk every
      recipe flow on-device
- [ ] Build notes to revisit: the Figma form has no save button (added a
      solid "Save recipe" at the bottom – design one if it should differ);
      "Add recipe to weekly plan" menu item is hidden until the Plan tab
      exists; editing an existing recipe reuses the form for facts only
      (ingredients/steps edit on the detail screen)
- [x] URL import – built 2026-07-12: paste a link on the Add-recipe screen,
      the app reads the page's embedded recipe data (JSON-LD and microdata
      flavors) and prefills the whole form for review; source link stored
      on the recipe. Verified live against valdemarsro.dk (Danish
      microdata, 14 ingredients + 5 steps + times parsed)
- [ ] Import fallback for bot-blocking sites (madensverden.dk, allrecipes
      refused non-browser fetches in testing): hidden-WebView fetch is the
      known fix if the family's sites need it – test the family's real
      sites first
- [ ] "Add from a link" sheet is improvised in code – design it if it
      should look different (2026-07-12)

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

- Recipe ingredient quantities are one free-text field per ingredient
  (decided 2026-07-12): parsed into amount + unit like the shopping list;
  unparseable text ("a pinch") passes through and never scales. Servings
  is its own stepper on the recipe (default 4, the scaling anchor);
  scaling happens in the planner as planned ÷ recipe servings, with
  sensible display rounding. Parser to handle "1,5" and "1/2".
- Recipes list gets one search field matching names AND ingredients – no
  manual tags/filters in v1 (2026-07-12); tags parked on the ideas list.

- DS 7-step colour ramps adopted (2026-07-11): tokens re-synced, existing
  screens remapped one step (old "lighter" tints are now "lightest" etc.)
  so backgrounds/badges kept their look; the brand green retuned
  (#47A518 → #56C91D). The DS's new Chip component is implemented natively
  at src/components/ui/chip.tsx (solid + outline, active/pressed/disabled),
  ready for the recipes milestone's filter rows.
- Solid buttons follow the DS button recipe now (2026-07-11): light-lime
  fill + ink label (was green + white). The app consumes button/* tokens
  from the theme fragment (classes like bg-button-solid-fill-enabled);
  "button" was added to the DS's NativeWind export list alongside chip.
  This was the visible piece of the redesign – Thomas flagged the phone
  still "looking old" when only ramp values had shifted.

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
- [ ] Bottom sheets duplicate the KAV + backdrop + white-bleed shell
      (4 sheets: recipe ingredient/step/import, shopping edit-item). Extract
      a shared BottomSheet component (carries the keyboard-bleed fix:
      marginBottom -80 / paddingBottom 120) so new sheets inherit it and it
      can't drift (2026-07-15)

## Design QA – sign-in + shopping vs Figma (found + fixed 2026-07-12)

Root cause for most of these was the DS `forms/*` tokens missing from the
DS's NativeWind export list, so the app improvised input colours. Fixed by
adding `forms` to the export list and re-syncing; the DS-defined active
border resolved to lime #83E651 (the #47A518 in the Figma file was the
pre-retune published value).

- [x] Shopping: the "Add an item" field and all edit-sheet fields had no
      active state – all text inputs now share src/components/ui/input.tsx
      (grey + #B5B1AB border at rest, white + 2px lime when focused, red
      on error)
- [x] Sign-in code boxes: boxes that hold a digit now keep the lime border
      and white fill (Figma signin 4), not just the box being typed into
- [x] Empty-state "Fill from weekly plan" border → button outline token
      (#83E651)
- [x] Done-list initials: two variants like the design – your own checks
      outlined (neutral-lighter fill, secondary border), other members
      filled secondary with an inverse letter, Montserrat display-6; wired
      checked_by_user_id through to the client for this
- [x] Live badge (and its connecting/offline siblings) fill: lightest →
      lighter ramp per the statusBatch component
- [x] "Add an item" placeholder: keep the disabled grey (Thomas,
      2026-07-12) – the dark text in the Figma mock is typed-value styling,
      not placeholder styling
- [ ] DS nit spotted in passing: color/text/contrast-text in the DS repo
      aliases color.text.primary (dark), while Figma renders it near-white
      – looks like a wiring slip in the DS token source, check on the DS
      side

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

- [ ] Renew the free signing on both iPhones every ~7 days until TestFlight
      takes over. IMPORTANT (learned 2026-07-15, both phones died mid-day):
      a plain `expo run:ios` rebuild REUSES the expiring profile and does
      NOT reset the clock – renew with `xcodebuild … -allowProvisioningUpdates
      -allowProvisioningDeviceRegistration` per device, install the .app via
      `devicectl`, then the user re-trusts on each phone. Fresh window from
      2026-07-15 → expires 2026-07-22. Fold the flag into build-iphone.sh so
      the routine rebuild actually renews.
- [ ] After every DS publish/retune (Thomas says "DS published"): rebuild
      tokens in the DS repo, `npm run sync-ds-tokens` here, diff
      ds-theme.cjs and walk the affected screens (agreed 2026-07-12)

## Pre-launch checklist (v1 ship)

- [ ] Proper trademark search for "Prepeat" / "Prep+Eat"
- [ ] App Store assets: icon, screenshots, description
- [ ] Privacy policy (required for accounts + a database)
