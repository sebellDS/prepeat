# Prep+Eat backlog

The working to-do list for the project. Scope and decisions live in
[projektgrundlag.md](projektgrundlag.md) – this file is about what happens
next and in which order. Completed items are pruned and live in git history;
the Decisions log below keeps the reasoning that's still worth having close.
Ideas graduate upward when we commit to them.

Ordering principle (agreed 2026-07-08): things that stand on their own and
deliver value by themselves come before things that depend on them – and
when a milestone finishes, the order gets a fresh look before starting the
next one.

Pruned 2026-07-24: the recipes, weekly-plan and multi-household milestones
all shipped (on TestFlight); their finished items were removed. Only open
threads remain below.

## Recipes & weekly plan (shipped – leftover)

- [ ] Import fallback for bot-blocking sites (madensverden.dk, allrecipes
      refused non-browser fetches in testing): hidden-WebView fetch is the
      known fix if the family's sites need it. STILL OPEN (confirmed
      2026-07-24): no WebView fallback exists in code (only a comment in
      recipe-import.ts naming it as the next step; react-native-webview
      isn't installed). Conditional – only build it if a site the family
      actually uses gets blocked.

## In parallel – when it fits

- [ ] TestFlight rollout – the pipeline works end to end (EAS cloud build →
      `eas submit` → TestFlight; builds 3-9 shipped, Thomas's phone installs
      and runs from TestFlight). Parent stays open until a SECOND phone is on
      TestFlight, since "both phones without cables" isn't true yet. See the
      [tester guide](testflight-tester-guide.md). Remaining:
      - [ ] Thomas: add Pia as a TestFlight internal tester (invited
            2026-07-23, not yet accepted). Internal testers must accept the
            App Store Connect team invite FIRST, then the TestFlight one, or
            it fails with a useless error. Send her the tester guide.
      - [ ] Keep running scripts/build-iphone.sh on PIA's phone every ~7 days
            until she's installed from TestFlight (Thomas's phone no longer
            needs it). Closes with the Recurring item once Pia is on TestFlight.
      - [ ] Optional: make scripts/eas-submit-ios.sh poll App Store Connect
            for the build going VALID as the real done-signal – `eas submit`
            can hang both when stuck AND after success, so the CLI isn't
            trustworthy. The watchdog already kills a genuinely-stuck submit.
- [ ] "Continue with Apple" button. STATUS 2026-07-24: not implemented (no
      Apple sign-in in the app). NOT strictly required by Apple – guideline
      4.8 only forces it when you also offer a third-party login
      (Google/Facebook), and Prep+Eat only offers email-code sign-in. Keep
      as an optional convenience.
- [ ] Resend-code feedback states ("Sending…" / "New code sent" / retry) are
      improvised in code – design them if they should look different
      (2026-07-08). Confirmed still improvised 2026-07-24 (ResendLink in
      onboarding-flow.tsx; the file flags them as pre-design).

## Later (v1.1+)

- [ ] Merge two households / "copy a recipe to my other household" – the
      deferred merge mechanic that later lets a rejoiner bring their parked
      solo-kitchen recipes into the family (leave-household.md, rule A). Also
      covers a UX gripe Thomas hit 2026-07-22 walking the flow: leaving a
      household when you ALREADY have another spawns yet another solo
      "[Firstname]'s Kitchen" (clutter). Better: when you already have a
      household, let the copy-on-leave recipes land in an EXISTING kitchen you
      choose instead of a brand-new one.

## Tech debt (from the 2026-07-18 code review)

All verified still present 2026-07-24.

- [x] **List/plan open runs its queries twice** – DONE 2026-07-24. (1) The
      realtime `SUBSCRIBED` handler no longer refetches on the FIRST subscribe
      of a channel (boot / viewWeek already loaded that list/week) – a
      per-channel `subscribedBefore` flag means only a RE-subscribe (reconnect)
      refetches, so opening the tab no longer re-runs items+prefs+weekOptions a
      second time. Reconnect catch-up is fully preserved. (2) Shopping's boot
      ran `getOrCreateListId` then `fetchPrefs` in series though they're
      independent – now `Promise.all`'d (meal-plan's boot is genuinely
      dependent, weeks→entries, so left serial). Client-only, typecheck + lint
      clean, rides the next build.
      Trade-off (disclosed): skipping the first-subscribe refetch reintroduces
      a tiny [boot-fetch → channel-live] gap where a concurrent edit from
      another phone could be missed until the next realtime event or a
      foreground refetch – seconds, self-healing, and easily reverted if it
      ever bites. Not yet walked two-phone on-device.
- [x] **Reorder saves one row at a time** – DONE 2026-07-24 (migration 0020).
      `reorderIngredients` / `reorderSteps` now call one atomic RPC
      (`reorder_recipe_ingredients` / `reorder_recipe_steps`) that renumbers
      the whole list in a single UPDATE via `array_position`, so an
      interrupted reorder can't leave it half-saved – and it's one round trip
      instead of ~20. SECURITY INVOKER (rides the caller's RLS). Typecheck +
      lint clean; not yet walked on-device.
      - [x] Thomas: applied migration 0020 in the Supabase dashboard
            2026-07-24 (verifying SELECT returned true / true).
- [x] **`swapMeal` duplicates `insertPlanEntry`'s snapshot + contribute
      blocks** – DONE 2026-07-24. Extracted the ingredient-snapshot insert
      into a shared `snapshotEntryIngredients(entryId, recipe)` helper that
      both paths call, so a swapped meal can't snapshot differently from a
      normally-added one. The `contributeEntry` call was already the shared
      function (only a one-line `if (pushed)` guard, left inline), and the
      rest of swapMeal (withdraw → delete old snapshot → update-in-place) is
      genuinely different from insert, so only the snapshot needed sharing.
      Behaviour-preserving (identical SQL); typecheck + lint clean, client-only
      (no migration), rides the next build.
- [ ] **Layout pinned with magic numbers**: per-screen tab-bar clearance
      hand-computed with a different tail across six screens, the done-section
      paints ~1000px of overdraw to reach the screen bottom, and the recipe
      overflow menu is pinned at `top: 52px`. Each breaks on a new device size
      or spacing-token change. Wants a shared clearance hook and anchored
      (not pixel-pinned) positioning.

## Security

- [x] **Invite codes should expire** – DONE 2026-07-24 (Thomas: lifetime
      **14 days**). Migration 0019 (applied) adds `rotate_invite_code()` (the
      single mint path: membership-checked, retires every live code for the
      household, then mints one fresh 14-day code) + a one-time backfill
      giving existing infinite codes a 14-day expiry. `getOrCreateInvite`
      rotates lazily on a missing/expired/legacy-null code; the Invite sheet
      shows "Refreshes on {date}" and a manual "Get a new code" (confirm
      dialog) that kills a leaked code at once. Sheet rebuilt to the Figma
      frame "Householde – invite" (271:14935) after review.

## Code debts (small, known, deliberate)

- [ ] **Unused `households.image_url` column** – the household image was
      dropped from the design 2026-07-22, so the app no longer reads or writes
      it (Edit household is name-only; `imageUrl` removed from the Household
      type/lib). The column (added migration 0010) is now dead. Drop it with a
      migration when convenient – harmless meanwhile.
- [ ] Offline/retry screens are improvised (added 2026-07-18 with the #3 and
      #6 review fixes): `HouseholdLoadError` in src/app/_layout.tsx (launch)
      and `LoadFailed` in src/app/shopping.tsx (shopping tab), both a centred
      title + reassurance + "Try again" button on the lightest surface. No
      Figma design for these states – design them if they should differ.
- [ ] Undo toast needs a real design. The "{item} deleted / removed · Undo"
      toast shipped 2026-07-24 (src/components/ui/undo-toast.tsx) across all
      three swipe-delete surfaces – shopping items, meal-plan "Remove meal"
      (replaced its confirm dialog) and recipe ingredients/steps – but it is
      an improvised placeholder (DS dark surface + brand-lime action, 5s, no
      Figma frame). Design it before launch. Also still uncovered: the bulk
      "Clear" in the shopping done section has no undo.

## Design QA leftover

- [ ] DS nit: color/text/contrast-text in the DS repo aliases
      color.text.primary (dark) while Figma renders it near-white – looks
      like a wiring slip in the DS token source, check on the DS side
      (spotted 2026-07-12).

## Ideas – not yet committed

- [ ] **Per-store category layouts** (Thomas, 2026-07-06): save the category
      order per named store ("Netto", "Bilka"…), so entering a store sorts
      the list to that store's layout. Simple version: pick the store when
      you start shopping. Stretch: auto-switch by location. Needs a small
      `store_layouts` table (household_id, name, category_order) on top of
      the existing single order.
- [ ] AI first-guess for categories, in front of the learned memory
      (decision #7 names this as the natural v1.1 upgrade).
- [ ] Smart quantity parsing when adding items ("Milk 2L" → name + quantity).

## Pre-launch checklist (v1 ship)

- [ ] Proper trademark search for "Prepeat" / "Prep+Eat".
- [ ] Icon/splash follow-ups (iOS app icon + launch screen shipped
      2026-07-23): Android adaptiveIcon still on Expo template art – needs
      an android-foreground (art inside the centre 66% safe zone) and an
      android-monochrome silhouette; no ios-dark / ios-tinted icon variants
      yet (iOS 18+ appearance icons); Android splash still uses Expo's
      splash-icon.png (the Android 12+ centred-icon-in-a-circle system can't
      reuse the full-bleed iOS launch image). None of this ships while it's
      iOS-only.
- [ ] App Store assets: screenshots, description.
- [ ] Privacy policy (required for accounts + a database).

## Recurring

- [ ] Renew the free signing every ~7 days until TestFlight takes over –
      now only PIA's phone needs it (Thomas's is on TestFlight). Run
      `./scripts/build-iphone.sh <UDID>`: it deletes the app's provisioning
      profile, rebuilds with `xcodebuild -allowProvisioningUpdates
      -allowProvisioningDeviceRegistration` (mints a fresh 7-day profile),
      installs the .app with `devicectl`, and prints the new expiry. WATCH
      the printed expiry – under ~7 days out means the free dev CERTIFICATE
      (also 7-day) is the limiter and needs regenerating too. Pia re-trusts
      the profile if prompted (Settings → General → VPN & Device Management →
      Trust). Pia's iPhone 17 UDID: `00008150-00086D290198401C`. (Note:
      `expo run:ios` does NOT pass -allowProvisioningUpdates, so xcodebuild
      must be driven directly – that's what the script does.) Closes once Pia
      is on TestFlight.
- [ ] After every DS publish/retune (Thomas says "DS published"): rebuild
      tokens in the DS repo, `npm run sync-ds-tokens` here, diff
      ds-theme.cjs and walk the affected screens (agreed 2026-07-12).

## Decisions log (recent)

- **2026-07-24 – dev vs TestFlight builds now have separate identities**
  (Thomas). Direct-to-device builds are a distinct "dev" app that installs
  ALONGSIDE the TestFlight app, so it's obvious which is which. Mechanism:
  `app.config.js` (new, layered on app.json) switches icon → `icon-dev.png`
  (Figma node 323:10079, "dev prep+eat" on light grey), bundle id →
  `app.prepeat.dev`, and home-screen name → "Prep+Eat Dev" when
  `APP_VARIANT=dev`. That flag is set by scripts/build-iphone.sh and the EAS
  development/preview profiles; ONLY EAS `production` (→ TestFlight/App
  Store) leaves it unset and keeps the real Prep+Eat identity. The Expo
  `name` is intentionally unchanged so the native project/scheme stays
  "PrepEat" (the build script hardcodes it); the dev label rides on
  CFBundleDisplayName. build-iphone.sh now runs `expo prebuild` before
  xcodebuild – this also permanently fixes the old bug where direct builds
  showed the stale Expo template icon (the local ios/ project was generated
  Jul 3, before the icon existed, and the direct build never re-ran prebuild).
- **2026-07-24 – meal-plan "Remove meal" confirm dialog → undo toast**
  (Thomas). Reverses the 2026-07-16 "remove has a confirm dialog" call: undo
  is the less-interruptive safety net, consistent with shopping and the
  recipe editor. Remove is now instant; a 5s "{meal} removed · Undo" toast
  revives the entry (and re-links it to the shopping list if the week was
  pushed). RemoveMealSheet deleted. The undo toast itself is still an
  improvised placeholder pending a Figma design.
- **2026-07-22 – multi-household journey shipped end to end** (16 commits,
  built slice by slice on device in the Prepeat brand). At a glance:
  - Switcher + join another household + post-join welcome interstitial
    (61aa239, 9135cc9); invite-someone sheet, code-sharing only – email dropped
    (052aae0).
  - Leave household with copy-on-leave incl. photos (f4277cd, migration 0015);
    Delete profile / GDPR erasure with type-DELETE fail-safe (25df0ac,
    migration 0016 – a direct auth.users delete from a SECURITY DEFINER RPC
    works, no Edge Function); Delete household, sole-member only (52fc9a9,
    migration 0017).
  - Photo cleanup on delete (645fb19); storage read policy scoped to members
    (7a34b34, migration 0018); household image dropped (fb7f60d); join
    back-arrow safe-area fix + solid Delete profile (3299d42).
  - Migrations 0015–0018 applied on Supabase. Walked the whole flow on device.
    Deferred: merge / copy-to-my-other-kitchen (incl. the "extra kitchen on
    leave" gripe).
- Storage hardening (2026-07-22): recipe-photo listing scoped to members
  (migration 0018) – the old broad SELECT let any client enumerate every photo
  path, undermining the "unguessable URL" privacy (Supabase flagged it). Public
  display is unaffected (public-bucket URLs bypass RLS). Copy-on-leave was
  reworked to FETCH originals via their public URL and re-upload, instead of the
  authenticated storage copy API, which the tighter policy would deny to a
  just-departed member. Verified on device (photos display, leave keeps photos,
  banner cleared).
- Household journey BUILT (2026-07-22, Thomas), slice by slice on device in the
  Prepeat DS brand (Montserrat + lime): multi-household switcher + join (61aa239),
  invite-someone sheet simplified to code-sharing only – email field dropped
  (052aae0), leave household with copy-on-leave incl. photos (f4277cd), delete
  profile / GDPR erasure with the type-DELETE fail-safe (25df0ac). Two learnings
  worth keeping: a direct `delete from auth.users` from a SECURITY DEFINER RPC
  works in Supabase, so **no Edge Function** was needed for erasure; and Leave/
  Delete live in the Edit-**profile** sheet (not Edit household). Deferred at
  the time: photo-orphan cleanup (since done), the post-join welcome
  interstitial. Invite-by-email was later DROPPED (2026-07-22).
- CORRECTION (2026-07-22): an earlier note in this session claimed a "DS retune
  to sage/Noto" requiring a whole-app re-theme. That was wrong – the sage/Noto
  values came from reading a DIFFERENT brand's mode in the multi-brand Sebell DS
  via get_design_context fallbacks. The **Prepeat brand is Montserrat + lime**
  (`ds-theme.cjs`), which the app already ships. No re-theme is needed; the
  household screens are correctly Prepeat-branded. Trust `ds-theme.cjs` over
  Figma get_design_context hex fallbacks (they can resolve another brand mode).
- Household journey designed + reviewed (2026-07-22, Thomas). The Figma
  "Household" page now covers the switcher (header "Household ▾" dropdown +
  "Join a household"), join-another-household (reuses onboarding invite-code →
  welcome), invite-by-email, and moves Leave/Delete into the Edit household /
  Edit your profile sheets. Reviewed and copy-fixed in Figma (spelling,
  "1 member", lowercase "household", leave/delete confirmation copy aligned to
  the specs). Terminology: the UI calls it **"Delete profile"** / **"Edit your
  profile"** (the spec's "account" = this "profile"). Open: the auto-name shown
  ("Thomas3' kitchen") must follow the spec format "[Firstname]'s Kitchen"
  (capital K, proper 's) when built.
- Delete account / GDPR erasure spec settled (2026-07-21, Thomas) – full
  write-up in [delete-account.md](delete-account.md). Calls: lives in Household
  (no Settings area yet); instant hard delete (no grace period); recipes added
  to a shared family stay with the family; the deleted person's name is cleared
  (nothing replaces it). Pre-launch, because Apple requires in-app account
  deletion for any app with account creation.
- Leave household spec settled (2026-07-20, Thomas) – full write-up in
  [leave-household.md](leave-household.md). Calls: Leave lives in Household;
  copy recipes only; new kitchen auto-named "[Firstname]'s Kitchen"; copied
  recipes re-attributed to the leaver (GDPR). Rejoin = plain join, no
  auto-merge, nothing lost (rule A) – the leaver's solo kitchen is parked
  until the household switcher ships. Surfaced that "Change household" is an
  unbuilt dependency; all filed under Later (v1.1+).
- Leaving again (2026-07-21, Thomas): one uniform rule – every leave takes a
  fresh snapshot into a new personal kitchen ("Anna's Kitchen 2"), never
  reuses the stale one, never leaves the person with nothing. Stale kitchens
  are cleaned up later by the switcher + merge (leave-household.md).
- Plan → shopping list stays live in step for the week ("A + rails",
  decided 2026-07-16). The auto-generated part of the shopping list is a
  live projection of that week's plan, not a one-time copy. When a plan
  entry changes (servings edit, meal added/swapped/removed), the linked
  shopping items reconcile automatically – but only lines that are still
  "clean" are touched silently:
  - **Clean line** (unchecked, not hand-edited) → quantity updates in place.
    Example: Friday 3 → 8 servings before shopping just rescales flour,
    onions, etc.
  - **Checked line** → left checked; show a "quantity changed in the plan"
    marker so the shopper decides. Never silently un-tick.
  - **Hand-edited line** ("we already have flour → 0") → never overwritten;
    flag the conflict instead.
  - **Meal removed** → pull back only its clean, unchecked contribution.
  - Requires each shopping line to track which meal(s)/entries contributed,
    so a single change rescales only that meal's share of a merged line
    (Friday onions + Wednesday onions in one "Onions" row). This is the
    data-model consequence to build for: `source_entry_id` alone is not
    enough once lines merge across entries – need per-contribution tracking.
  - Refines the 2026-07-07 "fill from weekly plan sweeps checked items"
    decision: that full rebuild-and-sweep becomes the explicit "reset this
    week's list" escape hatch (option B), NOT the everyday sync. Small plan
    edits must not wipe ticked items.
- Plan design – first draft reviewed 2026-07-16 (Thomas designed, Claude
  reviewed for gaps/spelling/wording). Decisions:
  - **No meal types in v1.** A day holds a flat list of meals – add as many
    as you like, no breakfast/lunch/dinner/snack distinction. The data
    model's `meal_type` field stays unused for now (this replaces the
    earlier "up to four meal slots/day" idea).
  - **"Servings" everywhere**, not "people" – the row labels and the
    stepper now agree (fixed in Figma).
  - **Editing a planned meal** is a swipe on the meal row, revealing four
    actions: move to another day, swap, change servings, remove (remove has
    a confirm dialog).
  - **Multi-add**: you can select several recipes for one day at once; they
    all take the same serving count in that single add (edit individually
    afterward).
  - Still open (not decided this round): whether recipe-less meals
    ("Leftovers", "Eating out") are allowed. (Settled 2026-07-18: yes –
    the Manual tab on the add-meal sheet, see the Manual meals entry.)
- Plan – week navigation (designed + reviewed 2026-07-16):
  - **Week switcher** below the header: `‹ July 13-19 · Week 29 ›`. You can
    go **2 weeks back**; chevrons are **disabled at the edges** (a direction
    with no created week is not navigable). The switcher only moves between
    weeks that exist – it does not create them.
  - **Creating a week is the header "+"** (kept separate from the switcher),
    opening an "Add new week" sheet: **Add a clean week** or **Copy this
    week's meals**. A copy must snapshot ingredients into the new week, not
    reference the source recipes.
  - **Dynamic header title.** The big title is relative to today – "This
    week" / "Next week" / "Last week" (and further out as needed) – while
    the date pill stays the precise anchor. (Was a static "This week" that
    read wrong on other weeks.)
  - **Recipe search filters as you type**; the "No recipe for X yet →
    Add recipe" empty state shows only when zero recipes match.
  - (Note: the header was later reworked into a segmented day bar, 2026-07-17
    – the copy-week feature retired then. See git history.)
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
  (#47A518 → #56C91D). The DS's Chip component is implemented natively at
  src/components/ui/chip.tsx (solid + outline, active/pressed/disabled).
- Solid buttons follow the DS button recipe (2026-07-11): light-lime fill +
  ink label (was green + white). The app consumes button/* tokens from the
  theme fragment (classes like bg-button-solid-fill-enabled); "button" was
  added to the DS's NativeWind export list alongside chip.
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
