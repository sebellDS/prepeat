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

Pruned 2026-07-25 (second pass): the 2026-07-18 tech-debt track, the
dev-build bug round and decision #8 all landed and were removed. Everything
below is open.

## Blocked on other people

- [x] **Second tester on TestFlight** – DONE 2026-07-27, state=INSTALLED in
      App Store Connect. The family now updates cable-free; the weekly-signing
      chore below is closed too. What actually went wrong (worth remembering):
      "never got the invite" was NOT the two-emails trap. She had accepted the
      App Store Connect TEAM invite (as an Admin) but was never added to the
      internal tester GROUP "Prep+Eat v. 1.0 test" – team membership does not
      make you a TestFlight tester, the two lists are separate. No tester slot
      → no invite email ever sent. Diagnosed via the ASC API (scratchpad
      tf-diag.mjs: /v1/betaTesters filtered by app vs /v1/users); the fix was
      adding her to that group. Whenever a family member "doesn't get the
      invite", check betaTesters vs Users-and-Access before assuming
      email/spam.
      Everything else in the pipeline works end to end (EAS cloud build →
      `eas submit` → TestFlight; builds 3-10 shipped). **Build 10
      (2026-07-25) is the current one.**
      - [ ] **Third tester** invited to TestFlight 2026-07-27, state=INVITED
            (not yet accepted). Send the [tester guide](testflight-tester-guide.md).

## Known bugs (open)

None. The last two closed on 2026-07-27: the badge lag (fixed, see the
decisions log) and the "blank swiped row" (never a bug – a short name
sliding out of view).

## Conditional – only if it bites

- [ ] **Import fallback for bot-blocking sites** (madensverden.dk, allrecipes
      refused non-browser fetches in testing). A hidden-WebView fetch is the
      known fix; nothing exists in code today (only a comment in
      recipe-import.ts naming it, and react-native-webview isn't installed).
      Only build it if a site the family actually uses gets blocked.
- [ ] **"Continue with Apple"** – not implemented. NOT required by Apple:
      guideline 4.8 only forces it when you also offer a third-party login
      (Google/Facebook), and Prep+Eat only offers email-code sign-in. An
      optional convenience.
## Later (v1.1+)

- [ ] **Merge two households / "copy a recipe to my other household"** – the
      deferred merge mechanic that later lets a rejoiner bring their parked
      solo-kitchen recipes into the family (leave-household.md, rule A). Also
      covers a UX gripe from 2026-07-22: leaving a household when you ALREADY
      have another spawns yet another solo "[Firstname]'s Kitchen" (clutter).
      Better: let the copy-on-leave recipes land in an EXISTING kitchen you
      choose.

## Code debts (small, known, deliberate)

- **NOT A DEBT – `fillFromWeeklyPlan` is unreachable from the UI on purpose.**
      Standing note so it stops being re-flagged as dead code (last reviewed
      2026-07-27). It is the "reset this week's list" escape hatch from the
      A + rails decision and the only repair path if a contribution ever fails
      mid-write (offline at the wrong moment – nothing retries it). Its doc
      comment and its RPC `push_plan_to_list` both say so.
- [ ] **DS nit** (diagnosed 2026-07-27, fix is in FIGMA not in code):
      in the **prep-eat** brand `color/text/contrast-text` aliases
      `{color.text.primary}` – i.e. the dark ink #4F4230 – where the **sebell**
      brand has it as a literal near-white #FBFBF9. That asymmetry between the
      two brand modes is the wiring slip; Figma renders near-white, so the
      export is what is wrong. `figma-exports/*.tokens.json` are generated FROM
      Figma, so hand-editing them would be overwritten – the variable has to be
      repointed in the Figma file, then re-exported and rebuilt.
      NO EFFECT ON THE APP TODAY: the only contrast-text the app consumes is
      `error.contrast-text` (#FFFFFF), which is correct in both brands. Nothing
      uses text/success/warning/info contrast-text. So this is DS hygiene, not
      a bug in Prep+Eat, and it can wait for the next DS pass.

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
- [ ] **Share a recipe** (Thomas, 2026-07-25): send one out of the household –
      to a friend, or to your own other kitchen. Questions to settle before
      building: does the recipient need Prep+Eat (deep link into the app) or
      should it be readable by anyone (a web page or plain text/PDF)? Does the
      recipe get COPIED to them (their own editable version, matching how
      copy-on-leave already works) or merely displayed? Photos are in a
      members-only bucket, so a public share needs a story for the image.
      Note the overlap with the deferred merge item under Later (v1.1+) –
      "copy a recipe to my other household" is the same mechanic pointed
      inward, so they are probably one feature and should be designed together.
- [ ] **Statistics on the plan – the app learns your habits** (Thomas,
      2026-07-25): the household has been building a real history in
      `meal_plan_entries` since July (every meal, its day and its servings),
      and today nothing reads it back except the "recently planned" ordering
      in the picker. Ideas it could support: what you actually cook most; what
      has not appeared in a while ("you haven't made X since May"); which day
      each meal tends to land on; seasonal patterns once there is a year of
      data; a nudge when a week looks like a repeat of the last one. Could
      feed planning directly – suggesting a week from your own rotation rather
      than a blank slate. No new data collection needed for the first version,
      which makes it cheap to try. Worth deciding early how much is a screen
      you visit versus quiet suggestions inside the existing flow.

## Pre-launch checklist (v1 ship)

- [ ] Proper trademark search for "Prepeat" / "Prep+Eat".
- [ ] Privacy policy (required for accounts + a database).
- [ ] App Store assets: screenshots, description.
- [ ] Icon/splash follow-ups (iOS app icon + launch screen shipped
      2026-07-23): Android adaptiveIcon still on Expo template art – needs
      an android-foreground (art inside the centre 66% safe zone) and an
      android-monochrome silhouette; no ios-dark / ios-tinted icon variants
      yet (iOS 18+ appearance icons); Android splash still uses Expo's
      splash-icon.png (the Android 12+ centred-icon-in-a-circle system can't
      reuse the full-bleed iOS launch image). None of this ships while it's
      iOS-only.

## Recurring

- [ ] **Renew the free signing every ~7 days.** BOTH phones now run the dev
      app ("Prep+Eat Dev", bundle app.prepeat.dev) from
      `./scripts/build-iphone.sh <UDID>` – no arg defaults to Thomas's. The
      2026-07-25 builds expire around **2026-08-01**; when the app stops
      opening, rebuild. The script deletes the provisioning profile, rebuilds
      with `xcodebuild -allowProvisioningUpdates
      -allowProvisioningDeviceRegistration` (minting a fresh 7-day profile),
      installs with `devicectl`, and prints the new expiry. WATCH that expiry –
      under ~7 days out means the free dev CERTIFICATE (also 7-day) is the
      limiter and needs regenerating too. Re-trust on the phone if prompted
      (Settings → General → VPN & Device Management → Trust).
      Device UDIDs are not kept in this public repo – read them off the Mac
      with `xcrun xctrace list devices`. (Note: `expo run:ios` does NOT pass
      -allowProvisioningUpdates, so xcodebuild must be driven directly – that
      is what the script does.) The TestFlight app is separate and unaffected,
      so this chore ends entirely once no phone needs cable builds.
      **PREMISE LOOKS WRONG (measured 2026-07-27):** the signing is a PAID
      team, so the profile runs to 2027-07-24 and the certificate to
      2027-07-06 – a year each, not seven days. The "expires 2026-08-01" date
      above is fiction. Kept as a safety net until mid-August; if the app is
      still opening fine then, delete this item.
- [ ] After every DS publish/retune (Thomas says "DS published"): rebuild
      tokens in the DS repo, `npm run sync-ds-tokens` here, diff
      ds-theme.cjs and walk the affected screens (agreed 2026-07-12).

## Decisions log (recent)

- **2026-07-27 – the Live badge now believes a fetch, but only so far**
  (verified on device by Thomas). The badge lag was never a race in our code:
  realtime-js only notices a dead socket at its next **heartbeat, 25s**
  (CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL), then reconnects on a stepped
  backoff of up to 10s more, while the foreground refetch repairs the DATA the
  instant the network returns. Two signals, two clocks – so "Offline" sat over
  visibly fresh items. `refresh()` now rebuilds the realtime channel when a
  fetch succeeds while the badge says Offline; `subscribe()` calls
  `socket.connect()` itself on a disconnected socket, so "Live" arrives in
  about a second instead of after the heartbeat plus backoff.
  The restraint is the part worth keeping: a successful fetch only moves the
  badge to **Connecting**, never straight to Live. Reaching the server proves
  you have a network; it does not prove the other devices' edits are
  streaming in, and only SUBSCRIBED proves that. The reverse direction was
  deliberately left alone – a FAILED fetch does not force Offline, because
  that would invent a new wrong-badge case (one flaky request flashing
  Offline while realtime is fine) to fix one the socket already handles.
  Also settled that day: the "blank swiped row" was never a bug (Thomas read
  it off the screenshot – a short name slides out of view when the row
  translates left by the two 56px actions), and the iPad joined the test
  fleet, which is why the badge could be verified without borrowing a second
  family member's phone.
- **2026-07-26 – imported recipes credit their source.** Raised as an idea the
  night before and built the same session, because the data turned out to be
  there already: the importer has stored `recipes.source_url` since
  2026-07-12, but `fetchRecipe` never selected it back, so it had been
  accumulating invisibly for two weeks. The whole job was reading the column
  and showing it.
  A quiet underlined "From justonecookbook.com" sits between the instructions
  and the Edit recipe button – placement and style Thomas's call (the same
  paragraph / text-subtle as the Plan tab's status line), then made a link on
  his follow-up. It opens the phone's browser rather than an in-app one: it is
  somebody else's site, and leaving the app makes that plain. Hand-typed
  recipes have no source and show nothing.
  Finished 2026-07-27: the source is now a **field on the recipe form** (last
  of the facts, under Servings, mirroring the detail screen), pre-filled by an
  import, loading the existing value when editing, and saving null when
  emptied so the credit can be dropped. Behaviour change worth knowing:
  `updateRecipeFacts` never touched `source_url` before, so editing left it
  alone – now the field's contents win, which is the point, but an edit CAN
  clear a source.
  Same round: **Edit recipe** joined the ⋯ menu between "Add ingredients to
  shopping list" and "Delete recipe" (Thomas), keeping its button at the
  bottom of the page too so a long recipe does not have to be scrolled. Both
  call one `openEdit` handler – the routing has a subtlety worth not
  duplicating (edit must stay in whichever tab's stack the detail is rendered
  in, so saving returns to the plan when opened from there).
  Still open if wanted: `sourceLabel()` shows the host only – a full recipe
  URL would wrap over several lines in that quiet style. The form field is
  IMPROVISED (no Figma frame), like the detail line.
- **2026-07-25 – build 10 shipped to TestFlight, and the submit script now
  ends with a fact.** Everything from the day went up in one build: decision
  #8, the undo toasts (including the bulk clear), the reorder gap animation,
  the recipe menu, the keyboard-aware toast, the swap sync fix and the tab-bar
  spacing. Confirmed VALID via Apple's own API, not the CLI.
  That confirmation is now built in. `scripts/asc-build-state.mjs` asks App
  Store Connect for the newest build's processingState, and
  `eas-submit-ios.sh` ends by polling it for up to 20 minutes – so a submit
  finishes by telling you what Apple actually has, instead of a hopeful
  message. This closes the "poll ASC for VALID" item: `eas submit` has been
  seen spinning long AFTER a successful upload as well as during a stuck one,
  so its own output proves nothing either way. The 600s watchdog still handles
  the genuinely-stuck case; the ES256 JWT details (aud, and dsaEncoding
  'ieee-p1363' – node's default DER is rejected) are in the script.
- **2026-07-25 – the tab bar was being counted twice** (commit af982ae).
  Chasing a toast that floated too high turned into a real find: every scroll
  screen carried ~50pt of dead space at the bottom. `tabBarClearance` was
  `insets.bottom + BottomTabInset(50) + tail`, but the tab bar is a NATIVE iOS
  one (expo-router NativeTabs) and a native tab bar already contributes its
  height to the safe-area inset of the screens inside it – so the 50 was pure
  double-count and should never have existed. `BottomTabInset` is deleted, not
  retuned; `tabBarClearance` is now `insets.bottom + extra`, which makes each
  screen's tail an honest gap in points. The undo toast folds back into the
  same helper (its verified position is exactly `insets.bottom + 16`), so
  there is one model instead of two.
  How it was settled, and the reusable bit: Thomas measured the gap at three
  different offsets (+54pt → 82px, +74pt → 112px, +16pt → 24px; his px are
  1.5× points). Each gap equalled exactly what was added on top of
  insets.bottom, which pinned the model down with no guessing. Claude had
  first tried to *reason* the number out and made it worse – three
  measurements beat an argument. The numbers now live in the helper's comment
  so the next person sees where they came from.
- **2026-07-25 – undo now covers the bulk clear too.** "Clear done items" was
  the last delete without a safety net, and the most destructive one. It now
  shows "N items cleared · Undo" and one tap brings the whole batch back. Two
  things surfaced while building it:
  - The earlier reducer refactor (same day) had quietly given bulk clear a
    BROKEN undo: `clearCompleted` dispatched one `remove` per item, so the
    snapshot ended up as whichever item happened to be last, and a toast
    appeared naming one arbitrary row that Undo alone restored. Claude's own
    regression, caught while implementing the real feature. Bulk clear is now
    a single `clear-completed` action so the reducer snapshots the batch.
  - The server delete now targets the exact ids taken off screen instead of
    "every checked row in this list". The blanket version could also sweep
    away something the OTHER phone ticked a second earlier – which undo would
    then not bring back, because it was never in the snapshot.
- **2026-07-25 – every improvised screen blessed as designed** (Thomas, after
  walking them on device: *"every designed-block is approved and looks
  great"*). These stop being improvisations and become the design: the **undo
  toast** in both its resting positions (above the keyboard, above the tab
  bar); the **edit-item sheet** at 55% minimum height with "Done" pinned below
  the scroll; the **Plan status line** "Your shopping list updates as you
  plan." at the bottom of the day list and the **Shopping empty state** that
  pairs with it; the **offline/retry screens** (`HouseholdLoadError`,
  `LoadFailed`); and the **resend-code feedback states**. No Figma frames were
  drawn for any of them – the on-device build was the review surface. Worth
  noting for the future: this is the opposite of the 2026-07-17 rule ("build
  the design, never an approximation"), and it worked here only because each
  piece was small, shown on-device within minutes, and explicitly flagged as
  improvised rather than passed off as designed. Held back from the blessing
  because it was a missing feature rather than an undesigned one: the bulk
  "Clear done items" had no undo – built the same evening, see above.
- **2026-07-25 – the plan→list link step retired** (projektgrundlag decision
  #8, commit 6a251e3). Started as a product question from Thomas, not a bug:
  *"why do we need the button 'Update shopping list'?"* – then, on learning a
  week stayed unlinked until someone pressed it once, *"I want to delete the
  button all together."* The button was working as designed; the design had
  quietly been outdated by two changes from 2026-07-16 (per-week lists 0008 +
  live A + rails reconciliation), which removed the problem the opt-in solved.
  Every meal now contributes on write, `resolve_week_list` creates a new
  week's list on demand, migration 0021 swept in the three existing weeks, and
  a status line replaced the CTA. Net −23 lines. Worth remembering: nothing in
  the tests, types or lint could have flagged this – only asking whether the
  UI still matched the model.
- **2026-07-25 – two-phone realtime testing, finally possible.** Both phones
  got the dev app, all six tests passed, and one real bug fell out that a
  single phone could never have shown: a **swapped meal did not reach the
  other phone**. Realtime payloads carry no recipe join, so the receiving
  phone fell back to the cached title/image – it updated `recipeId` while
  still showing the OLD recipe's name and photo. The shopping list WAS
  correct (that reconciliation is server-side), and that asymmetry is what
  pinned it down. Lesson: sync bugs need two devices; "it works on my phone"
  is not evidence.
- **2026-07-25 – first dev-variant test round** (Prep+Eat Dev on Thomas's
  phone, six build/test cycles). Tested the tech-debt work from 2026-07-24;
  reorder + swap passed. Fixed from the feedback:
  - **Reorder sheet** was unusable on a long ingredient list – it grew past the
    notch and the close button was unreachable. Now capped below the safe area
    with the rows scrolling inside (scroll freezes while a row is dragged).
    Thomas then asked for the surrounding rows to slide aside and open a gap
    where the dragged row will land – built, so you can see the target slot.
  - **Recipe ⋯ menu** was pinned at a magic `top: 52px`; anchoring it to the
    measured header put it too high (the header offset is not the screen
    offset), so it now uses `measureInWindow` on the icon itself. Plus a soft
    drop shadow (needs explicit iOS shadow* + Android elevation; NativeWind's
    shadow-lg renders flat, and `overflow-hidden` KILLS an iOS shadow).
  - **Undo toast behind the keyboard** – see Known bugs. Worth remembering as
    a process point: Claude reasoned from code to a confident but WRONG
    conclusion ("provably a stale-ref snapshot"); Thomas found the real cause
    by looking at the screen. Read the device before trusting a code-only
    theory.

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
