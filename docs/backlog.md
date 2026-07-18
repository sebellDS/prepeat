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
      solid "Save recipe" at the bottom – design one if it should differ).
      (Two stale notes cleared 2026-07-16: "Add to weekly plan" is now
      wired into the recipe menu, and the edit form has been full-featured
      – ingredients/steps included – since the focused-sheet rework
      2026-07-15, not facts-only.)
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

- [x] Design: weekly plan screen (Plan tab) – reviewed 2026-07-16 (Thomas),
      see decisions log. Copy/QA fixed in Figma the same day. Three
      follow-ups designed + reviewed 2026-07-16:
      - [x] Moving between weeks (prev/next switcher; nav disabled at the
            edges, 2 weeks back is the limit)
      - [x] Header "+" = add another week (clean or copy-this-week's-meals)
      - [x] Empty-search state in the recipe picker (leads to "Add recipe")
- [x] Parked question, RESOLVED 2026-07-16: how do mid-week plan changes
      (new meals, changed servings) reach a non-empty shopping list? Answer:
      the list live-reconciles with the plan for the week (A + rails, see
      decisions log). The week switcher on the shopping list (above) gives
      each week its own list that stays in step with its plan.
- [x] Design + build: week switcher on the shopping list (designed +
      built 2026-07-16). Migration 0008 makes lists per-week (the legacy
      list becomes the current week's); the picker mirrors the plan's
      navigation rule (existing lists ∪ plan weeks ∪ current week, two
      back); an untouched week shows the normal "Time to prep" empty state
      whose "Fill from weekly plan" fills from THAT week's plan.
- [x] Apply migration 0008 in the Supabase dashboard – needed a second run
      (2026-07-16): the first apply silently executed only part of the SQL,
      leaving the old one-list-per-household index in place, which broke the
      shopping boot (blank list + Offline badge). LESSON for every future
      migration: the Supabase SQL editor runs ONLY the highlighted text if
      any is selected – click once in the editor to clear the selection
      before hitting Run, and prefer migrations that end with a verifying
      SELECT so success is visible.
- [x] Design nit settled 2026-07-16: Thomas unified the week picker in
      Figma (quiet grey component on both tabs); code follows, variant
      prop removed
- [x] Build: meal plan tables + screen, ingredient snapshots into the
      shopping list, realtime like the shopping list (built 2026-07-16:
      migration 0007, Plan screen with week switcher/add week/add meals/
      swipe actions, A+rails reconciler in src/lib/plan-shopping.ts,
      "Fill from weekly plan" now pushes the real current week)
- [ ] Apply migration 0007 in the Supabase dashboard (Thomas; SQL goes on
      the clipboard) – the Plan tab needs it
- [ ] Walk every Plan flow after 0007 is applied (web preview needs
      Thomas's sign-in code; then on-device build) – typecheck/lint are
      clean and the web bundle compiles, but no flow has been driven yet
- [x] First on-device feedback round (Thomas, 2026-07-16) – fixed same day:
      far-swipe no longer checks items off; add-meal sheet taller and
      keyboard-aware; "Add all to shopping list" sits in the flow and flips
      to "Update shopping list" once the week is linked; servings default
      remembers the last used count; move-sheet rows say just the day name;
      the plan-changed marker is now a warning chip after the item name
      showing the calculated amount (with rounding – the raw float sum was
      a bug)
- [x] Second feedback round (Thomas, 2026-07-16) – fixed same day: week
      picker unified to the quiet grey component on both tabs (Figma
      164:2508); tapping a planned meal opens its recipe; the plan-changed
      chips dropped entirely (decision: the reconciler still updates clean
      lines, checked/edited lines just keep their value with no marker);
      recipe menu slimmed (no add-ingredient/add-instruction) and "Add to
      weekly plan" added with a day+servings sheet; recipe header spacing
      fixed to 16px; another stray "people" → "servings" in the
      add-to-shopping dialog
- [x] (Resolved – false alarm 2026-07-16): removing add-ingredient /
      add-instruction from the recipe menu loses nothing; the "Edit recipe"
      button covers adding ingredients/steps – the edit form has been
      full-featured (not facts-only) since the focused-sheet rework
      2026-07-15.
- [ ] The add-to-plan sheet (day + servings from recipe detail) is
      improvised in code – design it if it should look different
      (2026-07-16)
- [x] Build: add meal to multiple days (built 2026-07-17). "Add to multiple
      days" toggle under the servings stepper (add mode only) → button flips
      "Add to plan" → "Choose days" and the title "Add to {day}" → "Add to
      plan" → PickDaysSheet (src/components/plan/pick-days-sheet.tsx, title
      "Which days?", back arrow, subtitle names the recipe when one is
      selected else "Pick the days for these meals"). Originating day
      pre-checked. Works for one OR many recipes (cross product via
      addMealsToDays in meal-plan.tsx; addMeals now delegates to it). Back
      arrow restores the meal picker with its selection intact via a remount
      key (avoids a set-state-in-effect the React Compiler rejects).
      BottomSheet gained an optional onBack chevron. Copy fixed in Figma
      2026-07-17. Not yet walked on-device.
- [x] Multi-day feedback round (Thomas, 2026-07-17) – fixed same day:
      ALL bottom sheets now surface/neutral/lightest (the shared shell and
      the older hand-rolled ones – white was from the early designs);
      "Which days?" no longer scrolls (dropped the scroll wrapper, content
      fits); the DS switchField control swapped for the NATIVE switch (the
      32×20 web-sized toggle is too small a touch target – layout stays
      control-left/label-right; swap back when the DS gets a touch-sized
      switch variant, DS-side task); duplicate shopping lines from
      multi-day adds fixed (concurrent contributeEntry calls raced past
      each other's inserts – "6× Avokado"; writes are now serialized per
      add action).
- [x] Add-meal sheet v2 (Thomas slept on it, designed + built 2026-07-17,
      Figma 207:45960): progressive disclosure – servings, day chips and
      the button appear only once a meal is selected; a row of seven day
      chips under the counter (originating day pre-active) REPLACES the
      multi-day toggle + "Which days?" second sheet entirely. One sheet,
      multi-day = tap more chips. Deleted: pick-days-sheet.tsx,
      switch-field.tsx, the context's single-day addMeals wrapper. Fixed a
      WEN → WED typo in the Figma chips. The wider 24px gap before the
      button is in. Follow-up same day: the shared Chip was rendering 32px
      tall while the frames specify 24px – chip.tsx now uses
      px-comp-small/py-comp-xsmall (components/small 8 + components/xsmall
      4, the correct COMPONENT-scale tokens), shrinking every chip (day
      chips, All/Favorites on Recipes and in the picker) to the designed
      size. Root cause per Thomas: the Figma chip component had its padding
      bound to semantic/layout/* instead of semantic/components/* – same
      values today (4/8), wrong scale. Thomas rebinds the Figma component;
      the app already sits on the component scale, so they stay aligned if
      the scales ever diverge.
- [ ] DS-side: design a touch-sized switch variant for the switchField –
      the current 32×20 toggle works on web, not on a phone (Thomas,
      2026-07-17). No switch in the app right now (the multi-day toggle
      died with the sheet redesign), so this is for the DS library's sake.
- [x] Recent recipes in the picker (annotation confirmed by Thomas,
      built 2026-07-17): the add-meal list orders the household's
      recently-planned recipes first (latest plan entries, deduped),
      everything else keeps newest-created order.
- [x] Disabled past days (designed + built 2026-07-17, Figma 207:47745):
      past day rows show the day label in text/disabled and – when empty –
      a quiet "No meal added" instead of the add affordance; past days
      with meals just show them. The add-meal sheet's day-chip row skips
      past days entirely (chips are Title-case short names now, stretched
      equally across the row per the frame). Confirmed by Thomas
      2026-07-17: past days' existing meals STAY editable (swipe works);
      only adding is closed.
- [ ] Day-chip width reality check (2026-07-17): seven chips at the new
      recipe (12px side padding) need ~398pt but a 393pt iPhone gives the
      row 361pt – "Mon" wrapped on-device. App deviation (documented in
      chip.tsx): GROW chips drop side padding one step to components/small
      (8px) + numberOfLines 1; hugging chips keep the full recipe. Thomas:
      retune the Figma 7-chip day row (or bless the compressed padding as
      the official stretched-chip recipe in the DS). Narrow-screen fallback
      added same day (Thomas asked): below ~388pt window width the day
      chips switch to 2-letter labels (Mo Tu We…, DAY_TINY in week.ts) so
      an iPhone SE (375) or small Android (360) still fits seven on one
      line – improvised behaviour, bless or redesign with the above.
- [x] Chip aligned for real (2026-07-17): Thomas rebound the Figma chip to
      component tokens and retuned the DS recipe – now components/medium ×
      components/small padding with a small-emphasized 12/16 label (32px
      tall), verified against packages/react Chip.module.css in the DS
      repo; chip.tsx matches, and a `grow` prop covers the stretched day
      chips. Token sync run same day: zero token changes (recipe-only).
- [ ] Build notes to revisit (2026-07-16):
      - The DS has no button/*/disabled tokens; disabled solid buttons
        borrow the onboarding convention (neutral-light fill + disabled
        text) instead of the pale lime in the Plan Figma – add disabled
        states to the DS button recipe and swap
      - Marker updates ride refreshes (foreground/reconnect), not realtime
        – contribution changes alone emit no realtime event on the item
      - Known A+rails edge: check an item, let the plan contribute to it,
        uncheck it, then remove the meal – the withdrawal subtracts a share
        that was never added. Rare; revisit if it bites
- [x] Revisit recipes once Plan is built (done 2026-07-16): "Add to weekly
      plan" wired into the recipe detail menu with a day+servings sheet,
      sharing the exact snapshot/scaling code path with the Plan tab
      (insertPlanEntry in src/lib/meal-plan.tsx), including the A+rails
      contribution when the week is already on the shopping list.
- [x] Manual meals – "Leftovers"/"Eating out" (designed + built 2026-07-18,
      Figma section 142:15357 "plan – add recipe"). This settles the
      question left open in the 2026-07-16 review: recipe-less meals ARE
      allowed. The add-meal sheet gets a Recipes/Manual toggle under the
      title (the "Pick a meal from your library." subtitle is gone in the
      new frames – removed in code too); Manual is one "Name of meal"
      field + "Add to plan", lands on the originating day only, snapshots
      no ingredients and never touches the shopping list. The "Weekly
      plan" display-4 title is back above the week switcher (212:59962).
      Data: migration 0009 (recipe_id nullable + title column on
      meal_plan_entries); swapping a manual meal to a recipe clears the
      title again. Improvisations, all BLESSED by Thomas 2026-07-18 after
      the on-device walk ("I like the design you build"):
      - Manual meal ROW in the day list: borrows the recipe row –
        placeholder icon, no servings line; swipe gives move/swap/remove
        but NOT change-servings (meaningless without ingredients). Tap
        does nothing (no recipe to open).
      - The Manual "Add to plan" button disables until a name is typed
        (frame 213:64576 draws it enabled beside the empty field).
      - Swap mode stays recipes-only – no Manual tab is designed for the
        swap sheet.
      - Placeholder reworded to "E.g. leftovers" (the frame's
        "Fx Pasta al Pomodoro" is Danish and a recipe-name example;
        Thomas approved the reword 2026-07-18). Figma copy still says the
        old text – update the frame when convenient.
- [x] Back from a plan-opened recipe returns to the plan (Thomas found the
      inconvenience 2026-07-18, decided for the native fix): the Plan tab
      is now its own stack – src/app/(plan)/ with the plan at "/", plus
      /recipe/[id] and /recipe/new re-exporting the Recipes tab's screens.
      Tapping a meal opens the recipe INSIDE the Plan tab (tab bar keeps
      Plan active), back pops to the plan, and the Recipes tab's own
      browsing state is untouched. "Edit recipe" stays in whichever stack
      the detail is rendered in (pathname check in recipes/[id].tsx).
      Unchanged, deliberately: "Add recipe" from the add-meal picker's
      empty state still jumps to the Recipes tab's form – creating a
      recipe is Recipes-tab work; revisit if the same back-complaint
      comes up there.
- [x] Week picker restyled on Shopping (Thomas, 2026-07-18, Figma weekNav
      163:38970 in the shopping frames): the quiet grey pill retired –
      Shopping now shows the exact Plan-tab switcher (40px green chevrons,
      serif date + week number). One shared component again: the Plan
      screen's inline switcher moved into ui/week-picker.tsx so the two
      tabs cannot drift; weekPickerLabel deleted from week.ts.
- [x] Apply migration 0009 in the Supabase dashboard (done 2026-07-18,
      verifying SELECT returned true/true)
- [x] Walk the manual-meal flow on-device after 0009 is applied (Thomas,
      2026-07-18: works, design blessed)
- [x] Household screen redesign (designed + built 2026-07-18, Figma
      section 213:65932; reviewed same day – review outcomes: email
      read-only + sign out added to the design, avatar rule = phone owner
      outlined / others solid with colors as drawn, invite code behavior
      unchanged). Decided up front: renaming IS in; every member equal –
      NO creator privileges; renames reach other phones at next app open,
      not live. Built: household card (image or primary-gradient home
      tile, name, member count, edit pencil), member directory with
      per-member name/email (NEW profiles table, migration 0010, synced
      from auth by trigger – app never writes it), Edit household sheet
      (rename + image via the recipe-photos bucket), Edit profile sheet
      (first name; email read-only), invite code with copy + share, sign
      out. New shared ClearableInput variant in ui/input.tsx. New native
      modules: expo-clipboard + expo-linear-gradient (pods refreshed).
      Improvisations to bless or redesign:
      - Picked household image previews in the sheet (recipe-form
        pattern) – the frame draws no picked state.
      - Save buttons disable until the name field is non-empty (frames
        draw them enabled) – same convention as the other sheets.
      - Copy feedback: the copy icon flips to a green checkmark for 2s
        (plan pre-approved by Thomas 2026-07-18).
      - DS decision (Thomas, 2026-07-18): outline buttons ARE 2px per
        the DS – every older 1px outline button in the app aligned the
        same day (recipes detail/form/list, shopping empty state,
        remove-meal Cancel, add-meal "Add recipe").
- [x] Apply migration 0010 in the Supabase dashboard (done 2026-07-18,
      verifying SELECT returned 2 / true).
- [ ] Walk the Household flows on-device after 0010 (rename, image pick,
      profile rename, copy + share code, sign out/in again)

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
  - Figma fixes applied 2026-07-16: round 1 – subtitle typo "you library" +
    broken "or add is" → "Pick a meal from your library."; nav active tab
    Recipes → Plan on all frames; stepper "people" → "servings". Round 2 –
    empty state reworded ("No recipe for X yet" / "…in your library"),
    week-copy option → "Copy this week's meals", Week 30 frame title →
    "Next week". Empty-state "Add to plan" disabled + list filtering handled
    by Thomas.
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
- [x] "Fill from weekly plan" loads sample data until the Plan tab exists
      – real since 2026-07-16 (pushes the current week's plan)
- [ ] Bottom sheets duplicate the KAV + backdrop + white-bleed shell
      (4 sheets: recipe ingredient/step/import, shopping edit-item). The
      shared BottomSheet now EXISTS (src/components/ui/bottom-sheet.tsx,
      extracted 2026-07-16; all 5 Plan sheets use it) – remaining work is
      migrating the 4 older sheets onto it

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

- [x] **Day picker as a segmented bar** – designed (Figma weekBar
      211:52272) + built 2026-07-17, together with the header redesign
      (211:51693). Decisions from that round:
      - The Plan header IS the week switcher now: ‹ dates + Week N ›. The
        big title, the relative This/Next-week title and the "+" all
        retire.
      - "›" past the last week silently creates a clean next week – the
        COPY-WEEK feature retires ("our interface is so strong that the
        copy function is not important", Thomas). add-week-sheet.tsx
        deleted.
      - weekBar: seven connected segments, always all 7 days, past days
        disabled text + no press; selected = active-chip pairing
        (chip/solid/fill/active + white) per "build it as rendered" – the
        file's surface/primary/light binding lags the DS (lime) and the
        unselected labels were bound to a white token; Thomas builds the
        proper component later, app maps to text/default meanwhile.
      - Cleanup: chip grow prop + compressed-padding deviation + 2-letter
        fallback (DAY_TINY) + relativeWeekTitle all deleted – the bar
        design obsoletes them. Chip is back to the pure DS recipe.
      - Note: weekBar is still app-local; when Thomas ships it as a DS
        component, re-verify against the component recipe.

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
      takes over. Now automatic + verified end-to-end 2026-07-16
      (Thomas's phone renewed to expire Thu Jul 23). build-iphone.sh:
      deletes the app's provisioning profile, then builds with `xcodebuild
      -allowProvisioningUpdates -allowProvisioningDeviceRegistration`
      (mints a fresh 7-day profile), installs the .app with `devicectl`,
      and prints the new expiry. KEY correction: `expo run:ios` does NOT
      pass -allowProvisioningUpdates, so the first attempt (delete + expo
      build) FAILED to sign – must drive xcodebuild directly. Profiles live
      at `~/Library/Developer/Xcode/UserData/Provisioning Profiles/` on
      Xcode 16. `devicectl` accepts the hardware UDID directly (no need for
      the separate CoreDevice id). WATCH the printed expiry – if it ever
      comes back under ~7 days out, the free dev CERTIFICATE (also 7-day) is
      the limiter and needs regenerating too. Pia's phone still on the old
      window – renew hers with a build too. User re-trusts on each phone
      after a fresh profile if prompted.
- [ ] After every DS publish/retune (Thomas says "DS published"): rebuild
      tokens in the DS repo, `npm run sync-ds-tokens` here, diff
      ds-theme.cjs and walk the affected screens (agreed 2026-07-12)

## Pre-launch checklist (v1 ship)

- [ ] Proper trademark search for "Prepeat" / "Prep+Eat"
- [ ] App Store assets: icon, screenshots, description
- [ ] Privacy policy (required for accounts + a database)
