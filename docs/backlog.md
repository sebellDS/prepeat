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

- [ ] **The same ingredient can still appear twice on the shopping list**
      (Thomas, 2026-07-29, looking at the week-32 demo list: *"a lot of item
      are the same, but named differently"*). `item_merge_key` (migration
      0013) is `norm_item_name(name) || ' ' || lower(trim(unit))`, so two rows
      merge only on an exact name AND an exact unit string. The mechanical
      halves are fixed (trailing unit words lifted out of the name, spelled-out
      units folded onto abbreviations). Two causes remain:
      - **Singular vs plural count units.** "1 clove garlic" and "5 cloves
        garlic" have the same name and still split, because `clove` ≠ `cloves`.
        Not folded in the parser on purpose: the merged row would print
        "8 clove garlic". The clean fix is to singularise the unit INSIDE
        `item_merge_key` (a new migration – never edit 0013) so rows merge
        while the displayed text keeps whichever natural form was stored.
        Same applies to cup/cups, slice/slices, sprig/sprigs, head/heads.
        NEEDS A DECISION from Thomas: change the key, or accept the split.
      - **Synonyms.** `onion` / `small onion` / `yellow onion`,
        `salt` / `kosher salt` / `cooking salt` / `flaky sea salt`,
        `olive oil` / `extra virgin olive oil`, `fresh cilantro` /
        `coriander leaves`. These are genuinely different strings and no
        mechanical rule settles them – "small onion" may well be a deliberate
        distinction, and merging UK/US names (coriander/cilantro) is a
        judgement about who the household is. Any fix here is a product
        decision, not a parser change, and probably belongs with the
        category-memory idea: let the household teach synonyms once, the same
        way it teaches aisles. **Now written up as its own v1.1+ item,
        "Teach-a-synonym", under Later** – see there for the data model and
        the design gap.
      Worth weighing against the listing copy, which promises the list "builds
      itself from the plan" – a shopper seeing garlic twice reads that as
      broken even when the quantities are right.

### Pre-build audit, 2026-08-02

Found by a multi-agent review of the whole shipping surface (5 angles –
RLS/security, auth lifecycle, data correctness, recipe import, UI states –
each finding then adversarially verified by a second agent that tried to
refute it; 13 survived, merged to the 10 below). Ranked by launch risk.

**Verdict: ship with caveats.** No cross-household data leak, no launch
crash, no hard-blocked flow – the security angle came back clean, and
`is_household_member()` / RLS hold up. **Build 12, in review with Apple, is
unaffected by all of this** – these are for build 13 and after. Suggested
cut: fix 1 and 6 before the next build, the rest as a fast follow.

- [x] **1. FIXED 2026-08-02. HIGH – an imported recipe was silently thrown
      away when its photo couldn't be fetched.**
      [src/app/recipes/new.tsx](../src/app/recipes/new.tsx)
      Fixed in two halves, matching the audit's advice: (a) the photo upload is
      now wrapped in its own try/catch, so a failed image saves the recipe
      WITHOUT the picture instead of losing everything – recoverable later from
      Edit; (b) any remaining save failure sets an error banner and leaves the
      form fully populated, so Save can just be pressed again. The banner is
      the SAME designed component already used by the onboarding and household
      modals (`bg-error-lightest` + `error-outline`), and it lives in the
      pinned footer beside the button that failed so it cannot scroll out of
      view on a long recipe. Message text goes through the existing
      `friendlyError()`, so "offline" reads as plain language.
      NOT yet verified on a device – see the verification note at the end of
      this block.
      On import, `photoUri` is set to the external image URL taken straight
      off the page (new.tsx:139), unvalidated. Save re-downloads that URL and
      uploads it (new.tsx:161-163). If the download fails – a relative path, a
      hotlink-blocked image, a 403, flaky signal – the upload throws and the
      catch at 204-207 only writes to the developer console and stops the
      spinner. No message, no retry: the whole reviewed recipe (title,
      ingredients, steps) is discarded and the user is given no clue their
      work is gone. The same silent catch swallows any failure of the database
      save too, so it is really "save has no user-facing error handling at
      all" – import merely makes the failure far more likely.
      This is the feature the listing calls the centrepiece, failing in the
      way most likely to get the app deleted.
      FIX: show a real error and keep the form populated so the user can
      retry; and make a failed photo upload NON-FATAL – save the recipe text
      without a photo rather than losing everything.
- [ ] **2. Shopping quantities drift wrong when a line is checked/unchecked
      around a plan change.** `supabase/migrations/0013_atomic_plan_push.sql`
      :185-191 and `0014_atomic_withdraw_rescale.sql`:83-96.
      `contribute` ALWAYS records that a meal contributed a quantity, but only
      adds it to the visible line when the line is unchecked and not
      hand-edited. `withdraw` later subtracts that recorded contribution based
      on the line's state AT WITHDRAW TIME. A shopper naturally checks and
      unchecks lines while shopping, so the two sides diverge: a contribution
      recorded while the line was checked (never added) gets subtracted once
      it is unchecked, driving a quantity to zero even though another meal
      still needs the item. `rescale` has the same asymmetry.
      Hits the "the list builds itself from the plan" promise directly.
      FIX: make contribute and withdraw symmetric – base the adjustment on the
      contribution ROWS actually recorded, not the line's live state, or
      recompute the line quantity from the sum of its live contribution rows
      on every change. New numbered migration; never edit 0013/0014.
- [ ] **3. "This week" is frozen at app launch, so a meal can land on last
      week.** [src/lib/shopping-list.tsx:489](../src/lib/shopping-list.tsx)
      and [src/lib/meal-plan.tsx:407](../src/lib/meal-plan.tsx).
      Both providers compute the current week ONCE at mount (empty-dependency
      useMemo) and never recompute. Returning to the foreground calls
      `refresh()`/`retry()`, neither of which recomputes the week. Leave the
      app open across a week boundary (Sunday night → Monday) and it still
      treats the finished week as "this week" – so a meal added to what looks
      like the current week actually lands on the PREVIOUS week's plan and
      list. Depends on iOS keeping the app alive across that exact boundary.
      FIX: recompute `currentWeekStart` on the AppState "active" handler and
      inside `refresh()`, instead of memoizing once at mount.
- [ ] **4. Imported text shows raw codes, and some amounts vanish.**
      [src/lib/recipe-import.ts:362](../src/lib/recipe-import.ts)-385.
      `cleanText` decodes NUMERIC HTML entities but not named ones, so
      `&rsquo;` `&eacute;` `&ndash;` survive as gibberish in titles, steps and
      ingredient names. Worse, `&frac12;` is not folded to ½ and the amount
      parser is ASCII-only, so `&frac12; cup sugar` fails to match a leading
      amount and is stored as the NAME with no quantity – the amount is
      silently lost on the shopping list. Mostly affects sites using the
      microdata/meta fallback rather than the dominant JSON-LD path.
      FIX: add a named-entity decode step (smart quotes, accented Latin,
      dashes, ellipsis, and `&frac12;`/`&frac14;`/`&frac34;` → ½ ¼ ¾) BEFORE
      the amount regex runs. Sits with the parser work already done 2026-07-29.
- [ ] **5. Three screens can still strand the user on an endless spinner.**
      [src/app/recipes/index.tsx:114](../src/app/recipes/index.tsx) (and
      42-46), `src/app/recipes/[id].tsx`:115-140, and the shopping week-switch
      at [src/app/shopping.tsx:150](../src/app/shopping.tsx).
      All only log load failures to the console, then render a bare spinner
      forever – the recipe-detail spinner has no header, so there is not even
      a visible Back button. A failed first load (offline, or a recipe another
      member just deleted) leaves the user stuck. The shopping week-switch is
      not covered by the boot-only error banner, so the list can go blank with
      no spinner and no message.
      **This is exactly the Plan-tab silent-spinner class fixed on 2026-07-27** –
      the shared `LoadError`/"Try again" component already exists and was
      simply never applied here. Reuse it; give the detail screen's loading
      state a header with Back.
- [x] **6. FIXED 2026-08-02 (stopgap, improvisation flagged). The invite code
      was printed in low-contrast lime, 2.01:1.**
      [src/components/onboarding/onboarding-flow.tsx:267](../src/components/onboarding/onboarding-flow.tsx)
      On the "household is ready" step the code is rendered in link-lime
      #56C91D on the near-white #F8F7F7 panel – below the 4.5:1 AA minimum and
      below even the 3:1 large-text floor. This is the ANSWER to the "not yet
      checked inside the app" question on the DS `text/link` nit under Code
      debts: yes, it is in the app, and it landed on the worst possible text –
      the code a new user must read accurately to give a family member full
      access to the household.
      DONE: swapped to `text/default` (#4F4230), measured **9.12:1** on the
      #F8F7F7 panel – clears both the 3:1 large-text floor and the 4.5:1 body
      bar with room to spare. One token, no layout change.
      - [ ] ⚠️ **IMPROVISED, flagged per the 2026-07-17 rule – a designed
            treatment is still open.** No Figma frame exists for the fixed
            state. `text/default` is the minimum change that stops the
            accessibility defect; it also makes the code read like body text
            rather than something to copy. Two better options were measured
            and both pass: `text/brand` #378112 at 4.55:1, or **white on a
            filled #378112 chip at 4.87:1** – the last keeps the brand green
            AND makes the code look like a thing to be copied, which is what
            it is. Design it and I'll build exactly that; until then this is
            Claude's stopgap, not Thomas's design.
      The DS-side retune of `text/link` is the separate, slower fix – see the
      DS nit under Code debts.
- [ ] **7. The invite-code guess limit is per-account, so extra sign-ups
      bypass it.** `supabase/migrations/0012_throttle_invite_redemption.sql`
      :37-49. Joining is the one action that crosses the household boundary
      for a non-member, and the only guard on the 4-character code is 10
      tries/hour keyed to the individual ACCOUNT – so N throwaway accounts get
      10×N parallel guesses. A hit lands the guesser in a stranger's
      household with full access to its recipes, plan, list and every member's
      name and email. Mitigated by the tiny launch user base, the 14-day
      expiry, and that it only ever lands them in a RANDOM household, never a
      chosen one. Not a launch blocker – the verifier said so explicitly.
      FIX (post-launch): throttle by the CODE being guessed (or by IP) rather
      than by account, so total guesses against a code are capped however many
      accounts try. A longer code would also help.
- [ ] **8. `liter` and `liters` split into two shopping rows – a regression
      from migration 0024.** `supabase/migrations/0024_merge_key_ignores_unit_
      plural.sql`:61. The unit normalizer strips a trailing `s` OR `r` to
      merge duplicates. That fixes clove/cloves but breaks any unit whose
      singular ends in r: `liter` → `lite` while `liters` → `liter`, so
      "1 liter milk" and "2 liters milk" never merge. Same shape for
      container/containers. Narrow (units only, r-ending forms only) but it
      shipped on 2026-07-30, three days before this audit.
      FIX: strip only a trailing plural `s`, or use a small known-unit synonym
      map instead of blanket letter-stripping. New migration.
- [ ] **9. A raw API call can leave an account belonging to zero households.**
      `supabase/migrations/0001_households_and_shopping_lists.sql`:157.
      The leave rules – reject leaving your only household, snapshot recipes
      on the way out for GDPR – live in the `leave_household` FUNCTION, which
      the app always calls. But the underlying delete-your-own-membership
      permission has no such guard, so a direct API client using the shipped
      anon key could delete its only membership row and break the "every user
      always belongs to a household" invariant, or leave a shared household
      with no copy-on-leave snapshot. Unreachable from the UI; blast radius is
      the caller's own account only.
      FIX: tighten the delete-self policy so it cannot remove a solo
      membership, or revoke direct delete on `household_members` and force
      every leave through the function.
- [ ] **10. A member can mint a never-expiring invite code via raw API.**
      `supabase/migrations/0001_households_and_shopping_lists.sql`:165-169
      (and :52). The 14-day expiry is enforced only in the rotate function,
      not in the database: the expiry column is nullable with no default, the
      insert permission never checks it, and the redeem function still accepts
      codes with no expiry. So a CURRENT member using the anon key directly
      could plant an indefinitely-valid code – e.g. to rejoin after leaving.
      Requires an already-trusted insider using off-app tooling, exposes
      nothing to outsiders, and self-heals: the next "New code" rotation
      retires the planted code.
      FIX: make the expiry NOT NULL with a 14-day default plus a CHECK that it
      is in the future, and drop the "no expiry" branch from redeem.

**Verification status of the 1 + 6 fixes (2026-08-02).** Typecheck and lint
both clean, and every NativeWind class used was checked to exist elsewhere in
`src/` – worth doing explicitly, because `tsc` does NOT catch an invented
class name (they are just strings, so a typo fails silently at runtime as
unstyled text). **NOT yet seen running.** Neither change is reachable in the
web preview: the invite-code panel needs a real signed-in session that has
just created a household, and the save banner needs a forced upload failure.
So per the definition-of-done rule from
[lessons-from-building-prepeat.md](lessons-from-building-prepeat.md), these
are NOT done yet – they are committed, not confirmed. Check both on-device on
the next build, and note the build number here when they are seen working.

Closed 2026-07-27:

- **The Plan tab spun forever on the phones.** Migration 0022 dropped
  `meal_plans.pushed_to_list_at` while the app the phones actually run
  (TestFlight build 10) still SELECTed it, so every plan load was rejected.
  Migration 0023 restored the column and Thomas ran it the same day: the plan
  loads again on build 10, with no new build and no reinstall. The rule that
  came out of it is in the decisions log.
- **A failed load left the Plan tab on a silent spinner** – the reason the
  outage above read as "won't load" instead of "something went wrong".
  `MealPlanProvider` only marked itself ready when the first fetch SUCCEEDED,
  so any boot failure (that outage, or simply opening the app with no signal)
  left a spinner with no message and no way out. Fixed by giving Plan the
  retry screen the app already had in two other places: `HouseholdLoadError`
  at launch and the shopping list's `LoadFailed`, both blessed as the design
  on 2026-07-25. Thomas spotted that the pattern already existed – worth
  checking for a precedent before calling something undesigned. Correcting a
  wrong note from earlier the same day: Shopping did NOT share this flaw,
  Plan was the only tab missing the recovery. **Not on the phones until the
  next build** – unlike the migration, this one is app code.
- **The Live badge lag** (fixed, see the decisions log) and the **"blank
  swiped row"** (never a bug – a short name sliding out of view).

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

- [ ] **Sign in with Apple (iOS)** – considered 2026-07-30 while setting up the
      App Review demo account, deferred to after v1.0 (Thomas: "Mailbox now,
      Apple later"). Findings worth keeping:
      - **Not required.** Apple's guideline 4.8 only forces a Sign-in-with-Apple
        option for apps using a THIRD-PARTY social login (Google/Facebook/…).
        Prep+Eat uses first-party email OTP, so it is exempt. This is a product
        choice, not compliance.
      - **It does NOT remove the demo-account work.** A reviewer signing in with
        their own Apple ID lands in a brand-new EMPTY account – the "reviews
        badly" risk. You cannot pre-seed the reviewer's Apple-ID account. The
        demo mailbox is what lets you hand over a full, seeded account, so it is
        still wanted even with SIWA.
      - **An addition, not a replacement.** Email OTP stays for Android (SIWA is
        effectively iOS-only) and for users without an Apple ID.
      - **Cost:** `expo-apple-authentication` (Expo SDK 56 supports it) →
        `supabase.auth.signInWithIdToken({provider:'apple'})`; Apple Developer
        portal (enable the capability, a Services ID + a key); Supabase Apple
        provider configured with those; capture Apple's name (given only on the
        FIRST authorization – feeds the onboarding first-name step); handle
        private-relay `@privaterelay.appleid.com` emails (they become the
        stored identity / the address shown on the Household screen); decide
        identity-linking if the same person later uses OTP with the same email.
      - **Design gap:** the Apple button glyph/label is Apple-specified (HIG),
        but its PLACEMENT on the welcome screen has no Figma frame – design
        first, per the no-improvised-UI rule.
- [ ] **Teach-a-synonym: merge two ingredient names the household says are
      the same.** This is the "advanced ingredient normalization (onion vs
      yellow onion)" line already in projektgrundlag under Later (v1.1+) –
      written up here 2026-07-30 after it showed on a real list as three
      un-merged Parmesans (`Parmesan`, `Parmesan cheese`, `shaved Parmesan
      cheese`) and onion split three ways (`onion` / `small onion` /
      `yellow onion`). See also the synonym note under Known bugs, which this
      supersedes.
      WHY IT CANNOT BE A PARSER RULE: these are genuinely different strings,
      and no mechanical rule settles them without breaking real distinctions –
      you cannot strip "cheese" (`cream cheese` ≠ `cream`), and `small onion`
      may be a deliberate distinction. The household has to decide.
      SHAPE (mirrors the learned-category pattern, decision #7, which is the
      precedent Thomas keeps pointing at):
      - A new per-household table, e.g. `item_name_alias(household_id,
        alias_name normalized, canonical_name normalized, primary key
        (household_id, alias_name))`, RLS `is_household_member` like
        `item_category_memory`. New numbered migration; never edit an applied
        one.
      - Fold the alias into the merge key: `norm_item_name` (or the merge
        step) resolves an alias to its canonical name BEFORE
        `item_merge_key`, so aliased rows merge and the canonical display name
        wins. Touches migration 0013's reconciler – needs care and re-test.
      - Teaching UI: on the shopping-list edit sheet, a "same as…" action that
        points item B at an existing item A. This is the ONLY genuinely new
        surface. NO FIGMA DESIGN EXISTS – must be designed before it is built
        (the multi-day-sheets rule: build Thomas's design, never an
        improvisation). Backend + merge logic can be built design-free; the
        sheet cannot.
      - Realtime: like categories, no realtime on the alias table itself – the
        visible effect is the shopping_list_items rows merging, already a
        realtime surface.
      Decision needed before any UI work: is an alias one-directional (B → A)
      or a group of equal names? One-directional is simpler and matches the
      category-memory precedent; start there unless Thomas wants groups.
- [ ] **Drag a meal to another day on the Plan screen** (Thomas asked
      2026-07-30: *"is it possible to drag a meal to another day in Plan? It
      has the slide to edit already"*). Answer: yes, and the data side is
      already done – the swipe "Move to another day" action already calls
      `plan.moveEntry(id, date)` in [src/lib/meal-plan.tsx](../src/lib/meal-plan.tsx),
      so a drag gesture would reuse that exact function. This is therefore a
      pure front-end gesture/animation build, not a data-model change. Filed
      as v1.1+ polish, NOT a missing capability: moving a meal between days
      already ships today via swipe → day-picker sheet (MoveDaySheet). Drag is
      a nicer way to do the same thing.
      WHAT MAKES IT MORE THAN A TWEAK: the Plan screen stacks all 7 days in a
      vertical ScrollView ([src/app/(plan)/index.tsx](../src/app/(plan)/index.tsx)),
      and each meal row already owns a horizontal swipe-to-edit gesture
      (ReanimatedSwipeable in [src/components/plan/meal-row.tsx](../src/components/plan/meal-row.tsx)).
      Three things need care: (1) gesture disambiguation between swipe-to-edit,
      vertical scroll and pick-up – the standard fix is long-press-to-lift;
      (2) auto-scroll while dragging so off-screen days are reachable; (3)
      per-day drop-target highlighting. Standard pattern (reanimated + a
      draggable-list approach), a few days of build-and-polish.
      DESIGN GAP – NO FIGMA EXISTS for the drag states (lifted card, drop
      highlight, drag handle). Per the build-the-design rule, these must be
      designed before the build, or the improvisation flagged here. Note there
      is a sibling drag interaction already designed+built on the shopping list
      (see decisions log ~line 998: rows scroll inside, target slot shown) –
      reuse its visual language rather than inventing a new one.
- [ ] **Drag a shopping item to another category** (Thomas, 2026-07-30).
      Pick up a single item and drop it on a different category group to
      recategorize it. Like the meal-drag item above, the data side already
      exists: `editItem(id, { ...aisle })` in
      [src/lib/shopping-list.tsx](../src/lib/shopping-list.tsx) (~line 771)
      already sets an item's aisle AND teaches `item_category_memory` so
      future items of that name auto-file to the same category. A drag-drop
      would call that same function with the drop target's category, getting
      the "learn it once" behaviour for free. Pure front-end gesture build.
      Filed as v1.1+ polish, NOT a missing capability: recategorizing already
      ships today via tap item → edit sheet → pick a category
      ([src/components/shopping/edit-item-sheet.tsx](../src/components/shopping/edit-item-sheet.tsx)).
      DISTINCT from the drag that already exists here – the shopping list
      already lets you drag category GROUPS to reorder them (inline drag,
      [src/app/shopping.tsx](../src/app/shopping.tsx) ~line 55, overlay in
      [src/components/shopping/inline-reorder-overlay.tsx](../src/components/shopping/inline-reorder-overlay.tsx)).
      This new item is dragging one ITEM between groups, a different gesture.
      WHAT MAKES IT MORE THAN A TWEAK: same three concerns as the meal drag –
      long-press-to-lift so it doesn't fight the row's swipe-to-edit and the
      list scroll, auto-scroll to reach off-screen categories, and drop-target
      highlighting on each group. Extra wrinkle: an item can also be dropped on
      the uncategorized/top region, and checked items sit in their own settled
      area – decide which regions are valid drop targets before building.
      DESIGN GAP – NO FIGMA for the item-drag states. Reuse the existing
      category-group drag visuals (decisions log ~line 998: rows scroll inside,
      target slot shown) rather than inventing new ones; flag any improvisation.
- [ ] **Recipe import: ingredient parsing beyond English and Danish**
      (scoped 2026-07-29 – Thomas: *"English and danish is the most
      important. Log other languages as later versions"*). The parser in
      [src/lib/recipe-import.ts](../src/lib/recipe-import.ts) splits an
      ingredient string into name + quantity. The language-INDEPENDENT half
      works everywhere already: leading amounts, ranges, vulgar fractions
      (½ ¼ ¾), metric units, parentheticals and colon-sentences. The half that
      needs to KNOW WORDS is hand-written vocabulary, and only English and
      Danish are complete:
      - **local spoon/measure units** – German `EL`/`TL`, Swedish `msk`,
        Dutch `eetlepels`, Spanish `cucharadas`, Italian `cucchiai`. Missing
        ones fall into the NAME: `2 EL Olivenöl` → quantity `2`, name
        `EL Olivenöl`.
      - **prep participles** – `, gewürfelt` / `, hackad` / `, tritata` /
        `, émincé` are all kept verbatim, so the shopping list reads
        `Zwiebel, gewürfelt`.
      - **"to taste" qualifiers** – `nach Geschmack`, `al gusto`,
        `selon le goût`, `efter smak` (Swedish – the Danish `efter smag` IS
        handled).
      - **alternatives** – only `or`/`eller` are known; `oder`, `ou`, `o`,
        `of` are not.
      - **Romance connector words** – `200 g de farine` → name `de farine`,
        `200 g di farina` → name `di farina`. The `de`/`di`/`du`/`della`
        should be dropped after the unit.
      Each language is roughly one units list + one participle list + one
      qualifier phrase – the same shape as the existing tables, ~30 lines.
      Worth doing per territory as the App Store rollout reaches it, since
      recipe sites are overwhelmingly local-language and this hits a user on
      their very FIRST import.
      One trap already found and guarded: French `c. à soupe` is a TABLESPOON,
      and reading the bare `c` as `cup` inflates the amount ~16x. The parser
      now bails out when `c` is followed by `à`/`a`. Any future language work
      needs the same paranoia about collisions with English abbreviations.
- [ ] **Share a recipe – FIRST ITEM IN v1.1** (Thomas, raised as an idea
      2026-07-25, weighed for v1.0 on 2026-07-27 and deliberately left out of
      it the same day: *"I must think some more over the sharing feature"*).
      The reason it is top of the list rather than one item among many:
      Thomas's case for it is that it is the growth mechanic, not a
      convenience – *"with out 'mouth to mouth' sharing, this app will not be
      a success. And having a recipe as a carrier will be key."* That case
      still stands; what is unsettled is the shape, and v1.0 was not the round
      to settle it in. Worth a spec doc (like leave-household.md and
      delete-account.md) before any code.
      Settled while it was briefly a v1 item:
      - **A shared recipe is a link to a page we host** (prepeat.app/r/<token>).
        Not a choice between "deep link" and "web page": an iOS universal link
        falls back to loading the URL in a browser when the app is not
        installed, so the page is the fallback target and has to exist either
        way. Recipients who HAVE the app get it opened there.
      - **The photo story is a non-issue** – contrary to the original note, the
        `recipe-photos` bucket is public-read (0006_recipes.sql). Migration 0018
        only stopped clients ENUMERATING it. Anyone holding a photo URL can
        already load it, so a public page can show the picture with no new
        infrastructure.
      - **Scope, so the deferral is not mistaken for a small job**: this is the
        project's first web deployment, plus a share-token table and
        universal-link setup on the domain. Roughly a week of new surface.
      Still open:
      - [ ] **How much the page shows a stranger.** The whole recipe, or a
            teaser (photo + title + "Get Prep+Eat to see it")? Thomas's
            argument for gating: a personal recommendation carries the install –
            *"I have this recipe, so please download the app to get it"* – and
            everyone who wants the recipe becomes a user rather than a reader
            who never installs. Claude first called deep-link-only "dead on
            arrival", withdrew it, and ended up recommending the teaser. A dial,
            changeable later if the install rate disappoints.
      - [ ] ⚠️ **Copyright on imported recipes – Thomas's question, 2026-07-27,
            NOT yet answered by anyone qualified.** Publishing an imported
            recipe is a different act from importing one. Importing to your own
            household is private copying; a public URL makes **Prep+Eat the
            publisher**, and takedowns arrive at our domain. What that turns on:
            ingredient lists are facts and not copyrightable (US/EU), bare
            procedural steps much the same, but headnotes, descriptive method
            prose and above all **photographs** are protected – and minor edits
            produce a derivative work, not a new one. There is no
            percentage-changed threshold that makes a copy legal.
            The sharp edge is the photo: `new.tsx:139` puts the scraped
            `imageUrl` into `photoUri` and line 162 uploads it to our public
            bucket, so imported recipes already carry a copy of the source
            site's photograph on our storage. Invisible while private, the most
            complaint-prone thing on a public page.
            Note the convergence: a **teaser page publishes almost nothing**, so
            gating largely sidesteps this. A full public recipe needs the
            mitigations: ingredients + a prominent link to the original, never
            the source's prose, never the imported photo – which needs photo
            PROVENANCE recorded, since a scraped photo and one you shot are
            today indistinguishable uploads in the same bucket.
            This question is NOT urgent while sharing sits in v1.1 – nothing
            ships publicly until then – but it is cheap to put to the attorney
            alongside the trademark clearance, so it is cross-referenced there.
      - [ ] **Does the recipient's copy get COPIED into their household** (their
            own editable version, matching copy-on-leave) or merely displayed?
            "Save to my recipes" is the conversion action if so.
      - [ ] **Revocation + snapshot.** A share token is readable by anyone
            holding the URL until revoked. Consistent with the project's
            snapshot principle, the page should probably show the recipe AS
            SHARED, not live – so later edits are never accidentally published.
      - [ ] A public share page makes household content readable outside the
            household, so the **privacy policy written for v1.0 will need
            updating** when this ships, and prepeat.app stops being a parked
            domain.
      Overlaps the merge item directly below – "copy a recipe to my other
      household" is the same mechanic pointed inward, so they are probably one
      feature and should be designed together.
- [ ] **Merge two households / "copy a recipe to my other household"** – the
      deferred merge mechanic that later lets a rejoiner bring their parked
      solo-kitchen recipes into the family (leave-household.md, rule A). Also
      covers a UX gripe from 2026-07-22: leaving a household when you ALREADY
      have another spawns yet another solo "[Firstname]'s Kitchen" (clutter).
      Better: let the copy-on-leave recipes land in an EXISTING kitchen you
      choose.

## Code debts (small, known, deliberate)

- [ ] **Recipe import leaves prep instructions in the ingredient NAME, and the
      shopping list inherits it** (found 2026-07-29 while shooting App Store
      screenshots). `parseIngredient` in
      [src/lib/recipe-import.ts](../src/lib/recipe-import.ts) only strips a
      LEADING amount + known unit; everything else stays in the name verbatim.
      Real items produced from imported recipes in the demo household:
      - `Prik Nam Pla (condiment for seasoning the egg, optional): Mix together
        some fish sauce, a squeeze of lime juice, chopped Thai chilies, and
        chopped garlic.` – a whole instruction the source site filed under
        `recipeIngredient`
      - `½ tsp black soy sauce (or sub dark soy sauce and reduce regular soy
        sauce to 2 tsp)`, quantity `1` – the `½` never parsed as an amount
      - `coriander leaves, 1 large handful` – quantity is not leading, so it
        stays in the name
      - `½ cup long beans, cut into short pieces`, `cheese, grated (any melting
        cheese will do)`, `garlic clove, cut in half`, `tomato, sliced`
      This is the shopping list – the feature the listing calls the centrepiece
      ("The list builds itself from the plan"). It makes an imported week's list
      read as broken, and it is why the store screenshot of Shopping is not
      usable as-is. Worth fixing at least: vulgar fractions (½ ¼ ¾) as amounts,
      strip a trailing `, <prep word>` clause, drop parentheticals, and reject
      ingredient strings that are obviously sentences.
      **PARSER FIXED 2026-07-29** (vulgar fractions, trailing prep clauses
      both opening AND ending in the prep word, parentheticals, `or`/`eller`
      alternatives, trailing amounts, colon sentences, US `c.` for cup –
      31 English + 18 Danish cases verified, range/Danish regressions intact).
      Danish vocabulary completed the same day; other languages are a v1.1+
      item under Later. Recipes imported
      BEFORE that date still hold the old mangled names; see the re-import
      gap below.
- [ ] **An imported recipe can never be re-imported** – the "paste a link"
      button in [src/app/recipes/new.tsx](../src/app/recipes/new.tsx) is gated
      behind `!editing`, so the edit screen has no import trigger. Found
      2026-07-29 when the parser fix above could not be applied to recipes
      already in the demo household. Consequence: every parser improvement, and
      every site that fixes its own markup, only ever benefits NEW recipes –
      existing ones can only be corrected ingredient by ingredient by hand, or
      by creating a duplicate and deleting the original (which also orphans the
      meal-plan snapshots). A "Re-import from source" action on the edit screen
      would fix it; `applyImport` already does exactly the right thing to the
      form, and `replaceIngredientsAndSteps` already saves it in place.
- [ ] **`meal_plans.pushed_to_list_at` is back, on purpose** – migration 0023,
      APPLIED 2026-07-27, an always-null compatibility shim so TestFlight
      build 10 keeps working. Nothing reads or writes it. Drop it
      again – a fresh migration, never by editing 0022 or 0023 – only once
      every tester's phone runs a build that does not SELECT it (11 or later,
      confirmed INSTALLED in App Store Connect, not merely committed here).
      No hurry: a nullable column nobody touches costs nothing.
- **NOT A DEBT – `fillFromWeeklyPlan` is unreachable from the UI on purpose.**
      Standing note so it stops being re-flagged as dead code (last reviewed
      2026-07-27). It is the "reset this week's list" escape hatch from the
      A + rails decision and the only repair path if a contribution ever fails
      mid-write (offline at the wrong moment – nothing retries it). Its doc
      comment and its RPC `push_plan_to_list` both say so.
- [ ] **DS nit – `text/link` fails contrast on white** (measured 2026-07-28
      while building the website). `text/link` is **#56C91D**, which is
      **2.15:1** against #FFFFFF – far below the WCAG AA minimum of 4.5:1 for
      body text. It is the token whose whole job is "this is a link", so it
      cannot be legible only on coloured surfaces.
      `text/brand` (#378112) is the same family and measures **4.87:1**, so the
      website uses that for links and underlines them as well, keeping colour
      off the critical path. Everything else measured clean: text/default 9.75:1,
      text/subtle 7.79:1, button label on lime 6.22:1.
      **SWEPT 2026-08-02, and it WAS in the app** – see finding 6 of the
      pre-build audit under Known bugs. The onboarding "household is ready"
      step printed the INVITE CODE in this token on the near-white panel
      (2.01:1), the worst possible place for it: the code a new user must read
      accurately to give a family member full access. **That screen is now
      fixed** (swapped to `text/default`, 9.12:1), and the sweep found no other
      app surface using `text/link`.
      **The TOKEN is still wrong**, so this stays open: #56C91D is 2.15:1 on
      white and its whole job is "this is a link". The DS-side retune is the
      real fix, and until it lands any NEW use of `text/link` reintroduces the
      defect. A real accessibility bug in the DS, not hygiene like the nit
      below.
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

- [x] **🚀 SUBMITTED FOR REVIEW 2026-07-31.** All App Store Connect metadata
      entered and the version sent to Apple ("Add for Review" → Submit). Build
      12, EU-27 only, Free, 4+, privacy label published, manual release – so
      after Apple approves, Thomas presses the release button to go live. See
      the itemised entries below and
      [app-store-connect-answers.md](app-store-connect-answers.md). NEXT: watch
      for Apple's review result; if the demo mailbox OTP is the sticking point,
      the Supabase test-OTP trigger is the documented fallback (see the demo
      account item).
- [x] **First-look trademark search done 2026-07-27** – full write-up in
      [trademark-search.md](trademark-search.md). Headline: the NAME is clear
      (nobody holds "Prepeat" anywhere; no EU/DK registration; Prepear Inc.
      holds classes 42+45 in US/UK/CA/AU but NOT in the EU). The TAGLINE is
      not: "Prep Eat Repeat" is registered in the UK in class 9 (software),
      and Sistema Plastics holds "PREP. EAT. REPEAT." in class 21 via WIPO.
      Domains: we already own **prepeat.app** and **prepeat.love** (both
      parked at Porkbun; .love registered 2026-06-12, the day the name was
      decided). prepeat.dk and prepeat.eu are available if wanted defensively;
      .com has been taken since 2004.
      - [x] **Tagline decided 2026-07-27: "prep. cook. eat. repeat."** – the
            launch-screen wordmark, promoted to the public strapline (24 chars,
            fits Apple's 30-char subtitle). Chosen knowing it is modestly
            risky rather than clean: it CONTAINS the registered UK class 9 mark
            "Prep Eat Repeat", separated only by a generic verb. See
            [trademark-search.md](trademark-search.md) for the reasoning.
            - [ ] ⚠️ **UK caveat – revisit before adding the UK storefront.**
                  Exposure is territorial: none in DK/EU, real in the UK, and
                  the App Store ships worldwide BY DEFAULT unless territories
                  are restricted at submission. Replacement already checked and
                  clean: "One kitchen, every phone." (25 chars).
      - [ ] Attorney clearance before filing an EUTM (classes 9 + 42) or
            launching in the US/UK. While you have them: **also ask the
            imported-recipe copyright question** from the share item under Later
            (v1.1+). It does not block v1.0 – nothing is published publicly
            until sharing ships – but the answer shapes that feature, and it
            costs nothing to ask both in one conversation.
- [x] **Privacy policy WRITTEN and PUBLISHED** –
      [privacy-policy.md](privacy-policy.md), dated 2026-07-27, live at
      https://thomassebell.github.io/prepeat-web/privacy.html since 2026-07-28.
      Covers what is collected and why, what is not, retention incl.
      soft-delete, GDPR rights, Datatilsynet as the complaints route, children,
      and hello@prepeat.app as the contact.
      - [x] **FACTUAL ERROR CORRECTED 2026-07-28, in both copies.** The policy
            listed only TWO processors and said "we do not use any other
            processors" – but **Resend** handles every user's email address and
            one-time code, and was missing. The old text also credited **Apple**
            with delivering the sign-in emails, which Apple does not do. Now
            three processors with accurate roles. This mattered: an incomplete
            processor list in a published privacy policy is a GDPR problem, not
            a typo. It was found only because the SMTP screenshot showed who
            actually sends the mail – nothing in the repo said so.
      - [ ] ⚠️ **VERIFY the data-residency wording with the attorney.** The
            policy says data stays in the EU (Supabase, Stockholm), which is
            true of the database – but sign-in now means an email address is
            processed by **Resend, a US company**, and on the free tier there is
            no EU region. The page currently states that transfer is covered by
            the Standard Contractual Clauses. That is the normal position for
            such a vendor and it is what Resend's DPA is expected to say, but it
            has NOT been read and confirmed. Do that, and fold it into the
            attorney conversation queued below.
      - [x] **Contact address DECIDED and CHANGED 2026-07-28: hello@prepeat.app**
            everywhere – all 8 references across privacy-policy.md,
            app-store-listing.md and the three web pages. Live on the site.
- [x] **App Store listing text DRAFTED** – [app-store-listing.md](app-store-listing.md),
      name / subtitle / promotional text / keywords / description / What's New,
      all within Apple's character limits. NOT yet committed to git.

Audit of what submission actually requires, done 2026-07-27. The items above
were already further along than this list claimed; the ones below were
missing from it entirely.

- [x] **The website is BUILT AND LIVE, 2026-07-28** –
      **https://thomassebell.github.io/prepeat-web/** (privacy.html, support.html and
      a minimal index). Separate repo `thomassebell/prepeat-web`, three static pages,
      no build step, no framework, no JavaScript, GitHub Pages on the free tier.
      Verified live on desktop and at 375px: no console errors, no horizontal
      overflow, Montserrat headings + IBM Plex Sans body loading, and **zero
      third-party network requests** – the fonts are self-hosted precisely so
      the page that promises "no third-party tracking" does not hand every
      visitor's IP to Google to render itself.
      ## ✅ THE URLs FOR APP STORE CONNECT (live 2026-07-29, verified over HTTPS)

      ```
      Privacy Policy URL   https://prepeat.app/privacy.html
      Support URL          https://prepeat.app/support.html
      ```

      The github.io address now 301-redirects to prepeat.app, so do not use it
      anywhere. `www.prepeat.app` and plain `http://` both redirect to the
      canonical https apex.
      - [x] **prepeat.app – DONE 2026-07-29.** Certificate `CN=prepeat.app`
            covering apex + www, valid to 27 Oct 2026, Enforce HTTPS on.
            - **Order matters, and the first instinct was wrong.** GitHub is
              explicit: claim the domain on the REPO first, then point DNS. Do
              it the other way and there is a window where anyone on GitHub can
              attach the name to their own Pages site. The cost of the correct
              order is that the site is briefly dark, which was free here
              because nothing pointed at it yet.
            - **Porkbun DNS, as changed** (there were never any A records to
              delete – Porkbun parks via ALIAS):
              - `ALIAS prepeat.app` → `thomassebell.github.io` (was
                pixie.porkbun.com). Porkbun supports ALIAS at the apex and
                GitHub accepts it – one edit beside the mail records instead of
                adding four A records, which is the safer operation.
              - `CNAME www.prepeat.app` → `thomassebell.github.io` (new)
              - deleted the parking wildcard `CNAME *.prepeat.app`
              - all 7 mail records untouched and re-verified afterwards
              Apex now flattens to GitHub's four IPs (185.199.108-111.153),
              identical across Google, Cloudflare and Quad9.
            - ⚠️ **`.app` is HSTS-preloaded**, so browsers refuse to fall back
              to HTTP. Until the certificate exists the domain is dark in a
              browser even though GitHub IS serving it – `curl http://` returns
              200. Confirmed not a misconfiguration: no CAA record blocks Let's
              Encrypt, DNS is stable, and the TLS error is simply GitHub
              answering with its default `*.github.io` certificate.
            - ⚠️ **The certificate genuinely got stuck, and the fix is worth
              remembering.** It never arrived on its own – not in 30 minutes,
              not in 2 hours, not overnight. The tell was that
              `https_certificate` was ABSENT from the Pages API response rather
              than showing a pending state: provisioning had never STARTED, as
              opposed to being slow. Everything else checked out (no CAA record
              blocking Let's Encrypt, DNS stable across three resolvers, GitHub
              serving the site fine over plain HTTP), which is what made it
              clear the problem was on GitHub's side, not in the DNS.
              **Fix: remove the custom domain and re-add it** (`PUT
              .../pages -f cname=""` then `-f cname=prepeat.app`). The field
              appeared immediately as `authorization_created`, then `approved`
              within a minute of triggering a fresh build. The rapid toggle left
              `status: errored` – a `POST .../pages/builds` cleared it.
              Do NOT reach for this while provisioning might still be in flight;
              it resets the queue position. Only once the field is missing
              entirely and hours have passed.
              Rollout across GitHub's edge nodes is not instant: for a minute
              some paths returned 200 and others failed. Not a fault, just wait.
            - [x] **Enforce HTTPS ON**, verified: `http://` → 301 → https, and
              `www` → 301 → apex.
            - [x] Mail re-verified AFTER all DNS changes: both root MX, root
              SPF, Resend DKIM, send.prepeat.app SPF + MX, and DMARC all intact.
      - [ ] **Two copies of the privacy policy exist** –
            `docs/privacy-policy.md` here (where it was authored) and
            `privacy.html` in the web repo (the one that legally matters).
            Change one, change the other. Worth collapsing to one source if it
            ever drifts in practice.
      - [x] **A THIRD copy existed and was deleted, 2026-07-28.** The app repo
            had a `gh-pages` branch quietly serving its own landing page and
            `privacy/index.html` – built in an earlier session for App Store
            submission, and never mentioned in this backlog. So two privacy
            policies with different contents were live on the internet at once,
            the older one naming two processors instead of three and giving the
            superseded contact address. That is the worst category of thing to
            have a stale public copy of.
            Claude's pre-launch audit MISSED it: the audit read the docs and the
            app config but never asked GitHub what the account was already
            publishing, and concluded "you need a website" while one existed.
            `gh repo list` + the Pages API found it in seconds. **Check what is
            already deployed before concluding something is missing.**
            Branch deleted (tip was `d41c6f9`), Pages deactivated on that repo,
            URL confirmed 404. Note it did NOT self-retire on the username
            rename as first predicted – GitHub rebuilt it under the new name,
            and it took the branch deletion plus a CDN expiry to actually go.
      - **IMPROVISED, flagged per the 2026-07-17 rule**: no Figma frames exist
            for any web page. They are typographic document pages assembled from
            DS tokens, deliberately restrained – a real marketing landing page
            is a design job and was NOT invented here. The index is minimal on
            purpose: enough that the domain does not 404.
      Note this survived the sharing deferral: dropping share from v1.0 did not
      remove the need for a web presence, it only shrank it – v1.0 needs two
      static pages, no database and no share tokens, where the v1.1 share page
      needs the rest. Build the small one now and the share page grows into it.
      **PLAN, settled 2026-07-28: neither piece costs anything new. Do not buy
      a one.com plan for this.** Thomas asked whether his paid one.com account
      could serve – it could, but only makes sense if it ALREADY includes web
      hosting + mail; buying an upgrade would be paying for two things he has
      for free:
      - [ ] **Pages → GitHub Pages.** Free for public repos (this repo is
            public), custom domain, free HTTPS. Serves the privacy policy and a
            support page as static HTML. Suggest a SEPARATE small repo
            (`prepeat-web`) rather than this one, so the site does not rebuild
            on every app commit and the app's history stays clean.
      - [ ] **Inbound mail → Porkbun email forwarding.** Free, up to 20
            addresses per domain, already included with prepeat.app. Forward
            hello@prepeat.app → thomas@sebell.dk and support requests stop
            vanishing.
            **Caveat worth knowing:** forwarding delivers TO your inbox, but a
            reply goes out as thomas@sebell.dk, not as hello@prepeat.app. A user
            writes to the app and gets an answer from a stranger's personal
            address. Fixing that needs a real hosted mailbox – Porkbun's own
            hosted email is a few dollars a month, or one.com IF the plan
            already covers it. Cheap either way, and it can wait until somebody
            actually writes in.
      - **Keep DNS at Porkbun** (it runs on Cloudflare) and add records there.
        Do NOT move nameservers – that means re-creating the Resend records
        elsewhere, and a mistake there stops sign-in for everyone. Inbound mail
        (MX) and outbound (Resend) do not conflict; they are different record
        types. The one collision risk is SPF – see the email decision in the log
        below, one record only, both senders inside it.
      Fit for the v1.1 share page too, with one caveat: static hosting plus
      client-side Supabase calls would render a recipe fine, but **link
      previews** (the card that appears in WhatsApp/iMessage) need per-recipe
      Open Graph tags in the served HTML, which a purely client-rendered page
      cannot produce. For a feature whose whole point is being passed between
      phones, that preview matters – so the share page needs either
      pre-generated HTML per share or a small server. Decide when share is
      designed, not now.
- [x] **Custom SMTP is configured – checked 2026-07-28, NOT a blocker.**
      Supabase's built-in sender would have been (2 messages/hour, no SLA,
      team addresses only – *"We urge all customers to set up custom SMTP
      server"*), and since every sign-in is an emailed code, the default sender
      would have meant the app simply did not work for the public. It is on:
      **Resend** (smtp.resend.com:465), sending as **hello@prepeat.app**, sender
      name "Prep+Eat", minimum 60s between codes to one user. So prepeat.app is
      already carrying live DNS records, which shortens the website item below.
      - [ ] **The Resend free tier caps at 100 emails/DAY** (3,000/month, one
            domain). One sign-in = one email, so 100/day is fine for the family
            and thin for a launch spike – and when it is hit, new users cannot
            get in at all, which is the same failure mode as the default sender
            just at a higher threshold. Decide before launch whether to move to
            Pro ($20/mo, 50,000) or launch on Free and watch it.
- [x] **One contact address, settled 2026-07-28: `hello@prepeat.app`.** All 8
      references changed and live (privacy-policy.md ×3, privacy.html ×3,
      support.html, index.html, app-store-listing.md). The app already MAILED
      from this address; now it is also the one every page tells you to write
      to, so the GDPR contact, the App Store support channel and the reply-to
      are a single address on the product's own domain.
      Why it mattered: the moment that decides whether a stranger trusts you is
      BEFORE any contact – they get a code from hello@prepeat.app, hit trouble,
      and the support page used to send them to prepeat@sebell.dk, a domain
      they had never seen. (Claude first argued the opposite, weighting the
      reply-from over the inbound direction, and withdrew it.)
      "Thomas Sebell, Denmark" stays as the named data controller in the policy –
      that is correct and legally required; only the contact address moved.
      - [x] **DONE 2026-07-28: Porkbun free email forwarding is live.**
            `hello@prepeat.app` → `prepeat@sebell.dk`, a mailbox Thomas created
            for the purpose – so replies go out as prepeat@sebell.dk rather than
            his personal thomas@, which is a better outcome than the plan
            assumed. Free, up to 20 forwards, included with the domain.
            **Deliberately NOT the $24/year hosted mailbox.** Buy that when the
            reply-from address actually confuses somebody, not before; it is a
            toggle in the same account.
            (one.com was ruled out entirely – it does not support .app domains.
            No loss: GitHub Pages does not care about the TLD.)
      - [x] **DNS verified after the change, 2026-07-28 – NOTHING BROKE, and
            the reason is worth keeping.** Enabling forwarding DID create a root
            SPF record, `v=spf1 include:_spf.porkbun.com ~all` – exactly the
            thing feared, and contrary to Claude's prediction that a
            receive-only forward would not add one. It is harmless anyway,
            because **Resend does not use the root domain for sending**:
            - `prepeat.app` TXT → `v=spf1 include:_spf.porkbun.com ~all` (new,
              Porkbun's forwarding)
            - `send.prepeat.app` TXT → `v=spf1 include:amazonses.com ~all`
              (Resend's, untouched)
            - `send.prepeat.app` MX → `feedback-smtp.eu-west-1.amazonses.com`
            - `prepeat.app` MX → `fwd1/fwd2.porkbun.com` (new)
            - `resend._domainkey.prepeat.app` → DKIM key, still present
            - `_dmarc.prepeat.app` → `v=DMARC1; p=none;`
            **The one-SPF-record rule is per NAME, not per domain.** Resend's
            envelope return-path is `send.prepeat.app`, so its SPF is checked
            against that subdomain and never against the root. Two records, two
            names, no collision. DMARC aligns twice over – by DKIM on the root,
            and by relaxed SPF alignment from the subdomain.
            **Keep the rule anyway**: anything that ever adds a second SENDER on
            the ROOT (a newsletter tool, a hosted mailbox that sends) must go
            into the root's single record beside Porkbun's include – it cannot
            have its own. Re-run `dig +short TXT prepeat.app` after any mail
            change.
      - **Bonus finding, feeds the residency question above**: that bounce MX is
            `eu-west-1` – Ireland. Resend is handling this domain's mail in an
            **EU region**, which is evidence (not proof) that sign-in emails are
            processed inside the EU rather than the US. Good for the privacy
            policy's data-location paragraph; still confirm it in Resend's own
            terms before treating it as settled.
- [ ] ⚠️ **The Apple reviewer cannot sign in.** `src/lib/auth.tsx:58` uses
      `signInWithOtp` – a one-time code emailed to you, no password anywhere.
      A reviewer handed an email address cannot receive that code, and offering
      to relay it by hand does not pass review.
      **Researched 2026-07-27: Supabase has NO fixed test-OTP for email.** The
      feature exists for SMS only (`auth.sms.test_otp` maps a phone number to a
      fixed code); there is no `auth.email.test_otp`, in the CLI config or the
      dashboard. The community workaround is a Postgres trigger that overwrites
      `auth.users.recovery_token` with a SHA224 hash of a known code and
      backdates `recovery_sent_at` past the 60s rate limit. **Rejected as the
      plan**: it writes into Supabase's internal `auth` schema, which is
      undocumented and changes without notice (the discussion thread already
      has it breaking after an update), it is a permanent known-code backdoor,
      and it is load-bearing for review while never exercised day to day – so
      it rots silently and fails at submission, which is the worst place to
      find out.
      **Plan instead: a real mailbox the reviewer can open.** A dedicated demo
      address on sebell.dk with webmail; App Review notes give the address plus
      the webmail login and one line of instruction. No auth-schema tampering,
      nothing shipped in the app, nothing to rot. If Apple pushes back, the
      trigger is the fallback, not the opening move.
      - [x] **Demo account built and seeded, 2026-07-30.** Mailbox
            `appreview@sebell.dk` created (webmail, its own password – shared
            with Apple only, never committed to this public repo). Bootstrapped
            in the app: signed in, name set, household **"Demo Kitchen"**
            created. Then seeded server-side with 9 recipes + a planned CURRENT
            and NEXT week + shopping lists (generator
            `scratchpad/gen-demo.ts` → the SQL, re-runnable; the weeks are
            `date_trunc('week', now())` so re-run it close to submission to keep
            "this week" populated). Verified recipes 9, entries 14. SEPARATE
            from "The Hanson Kitchen" (Thomas's own account, used only for the
            App Store screenshots) – the reviewer never sees the real household.
            **App Review Information ENTERED in App Store Connect 2026-07-31:**
            sign-in required = yes, username `appreview@sebell.dk`, mailbox
            password, contact (Thomas Sebell + phone + thomas@sebell.dk) and the
            §3 Notes (with the real webmail URL + password) all filled and saved.
            Prerequisite still on Thomas: the `appreview@sebell.dk` mailbox must
            be live so the reviewer can read the emailed OTP.
- [x] **Screenshots** – 4 iPhone 6.5"/6.9" screenshots (Weekly plan, Recipes,
      Shopping list, Household) uploaded to App Store Connect (verified
      2026-07-31). iPhone-only build confirmed – App Store Connect shows NO iPad
      screenshot requirement, so the iPad tab is correctly empty. The
      `app-store-assets/screenshots/` folder stays gitignored (real household
      data, public repo).
- [x] **App Privacy card in App Store Connect – ENTERED and PUBLISHED
      2026-07-31.** Declared as "Data Linked to You": Email Address, Name,
      Photos or Videos, Other User Content, User ID – every one for App
      Functionality, none for tracking, so the label has NO "Data Used to Track
      You" section, matching the listing's "NO ADS. NO TRACKING." promise.
      Resolved the CONFIRM: **User ID declared** (conservative, adds no tracking
      disclosure). Added **"Photos or Videos"** beyond the original draft –
      the app stores user recipe photos, a distinct Apple data type, and
      under-declaring is what gets labels rejected. Privacy Policy URL
      (prepeat.app/privacy.html) also set. Original draft:
      [app-store-connect-answers.md](app-store-connect-answers.md).
- [x] **The remaining App Store Connect paperwork – ENTERED 2026-07-31.**
      - **Age rating: 4+** (every content question None/No, "Made for Kids" NOT
        enrolled). Resolved the alcohol CONFIRM = None. Apple's new 2025
        social-media/UGC questions (which the draft predated) all answered No.
        **⚠️ The "User-Generated Content = No" answer MUST be revisited when the
        public recipe-sharing feature ships (v1.1+)** – that turns on real UGC
        visible to strangers and needs report/block controls (Guideline 1.2).
      - **Category: Food & Drink.** Subtitle "prep. cook. eat. repeat."
        Copyright "2026 Thomas Sebell".
      - **Territory: EU-27 only** – the UK-tagline call, decided EU-only so both
        the "Prep Eat Repeat" UK registration and Prepear (US/UK/CA/AU) are
        sidestepped entirely. Price Free, base country Denmark (DKK), manual
        release. Revisit territory before any US/UK launch.
      - **Content Rights: No** (does not contain third-party content) – business
        call, not legal advice: recipe link-import is user-initiated into a
        private household with attribution + source link. Thomas has no attorney
        and may not get one; the EU-only territory is the main trademark
        de-risk, so the attorney is now an expansion-time concern, not a
        launch gate.
- [x] **Build 12 shipped to TestFlight, VALID (2026-07-30).** Supersedes the
      "ship build 11" item – build 12 carries the Plan-tab retry screen, all
      the import/parser fixes, migration 0024's behaviour, the ds-check
      lockdown, and the household-switcher redesign. `autoIncrement` set the
      number (11 → 12 during the build). Marketing version 1.0.0.
      NOTE FOR NEXT TIME – the submit CLI hung TWICE (the watchdog killed both
      local watchers at 600s), yet build 12 landed on App Store Connect anyway
      ~25 min later: the upload runs on Expo's SERVERS and killing the watcher
      never stops it. So when a submit stalls, do not rush to retry or to the
      altool fallback – wait and poll `asc-build-state.mjs` for the specific
      build number first (a 24-min poll timed out here just before it landed;
      give it 30-40 min). Apple's VALID is the only truth, exactly as the
      recurring note says.
- [x] Export compliance handled – `ITSAppUsesNonExemptEncryption: false` is
      already in app.json, so submission stops asking every time.
- [x] In-app account deletion built (guideline 5.1.1(v), required for any app
      with account creation) – Delete profile, shipped 2026-07-22.
- [ ] **Confirm the support address actually receives mail** – see the
      two-addresses item above. Whichever address wins, it is promised in the
      privacy policy AND the App Store description and is the app's only
      support channel, so it has to work before either goes live.
- [x] **`prepeat://ds-check` no longer reachable in production (2026-07-30).**
      The token-debug screen is now development-only: the route redirects to
      home when `!__DEV__` (a deep link in a Release build goes nowhere) and
      the hidden tab trigger is only registered under `__DEV__`. Kept for dev
      use rather than deleted – it is the DS-token verification tool.
- [ ] Icon/splash follow-ups – iOS app icon + launch screen shipped
      2026-07-23; the **Android adaptive icon is DONE too** (foreground,
      background and monochrome art all present in assets/images, contrary to
      the older note here). Still open: no ios-dark / ios-tinted icon variants
      (iOS 18+ appearance icons), and the Android splash still uses Expo's
      splash-icon.png (the Android 12+ centred-icon-in-a-circle system cannot
      reuse the full-bleed iOS launch image). None of it ships while it is
      iOS-only.

## Recurring

- **HOW TO RUN A BIG SQL SCRIPT: the Supabase SQL editor TRUNCATES long
  pastes.** Standing note, learned the hard way 2026-07-30 – five failed
  attempts at one 46 KB rebuild script before it landed. Not a hypothesis: the
  same script cut off at the same point twice, and the "copy file content"
  button lost content too (Thomas: *"Not all of the files content get
  copied"*).
  What each shape failed with, so the symptoms are recognisable next time:
  - **One `do $seed$ … $seed$` block** → `42601: unterminated dollar-quoted
    string`, echoing only the first third of the file. A truncated DO block can
    never parse.
  - **Plain statements wrapped in `begin;` / `commit;`** → `23503` foreign-key
    violation. The `begin` arrived, the `commit` did not, so the first part
    rolled back and later statements referenced rows that had vanished. This is
    the dangerous one: it looks like a data bug, not a truncation.
  - **Plain statements, no transaction, ~196 of them** → another `23503`,
    further down the file.
  What worked: **collapse to ~13 multi-row statements** (one `insert … values
  (…),(…),(…)` per table instead of one insert per row), no transaction
  wrapper, and every insert preceded by a delete of the same fixed ids so the
  whole file is safe to RE-RUN from the top. 46 KB → 30 KB, 196 statements →
  13. End the script with a verification `select` (counts + one known-merged
  row) so success is provable rather than assumed – "Success. No rows returned"
  proves nothing about a script that was cut in half.
  Also: the editor warns "creates tables without enabling RLS" on scripts that
  create no tables at all. Pattern-matching false positive – choose **Run
  without RLS**, never "Run and enable RLS", which would change security
  settings as a side effect.
  Generator for the working shape:
  `scratchpad/gen-bulk.ts` from that session – it drives the app's own
  `importRecipeFromUrl` + `parseQuantity` offline, so seeded data goes through
  exactly the same parser as a real import.
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

- **2026-07-30 – five small UI bugs from on-device testing** (PR #9,
  branch `fix/small-ui-bugs`). All reported by Thomas walking the app on his
  iPhone, each built to device and confirmed before the next:
  - **Household edit icon → vertical 3-dot.** Both edit affordances (the
    household card and your own member row) now use `more-vert` instead of a
    pencil, matching the list-row swipe-hint style. Started as `more-horiz`;
    Thomas wanted the vertical dots as on the list rows.
  - **Recipe description is a text area**, not a single-line input (multiline,
    top-aligned, ~4 lines tall).
  - **Add to weekly plan (recipe detail)** gained the shared week navigator
    (plan a recipe into a future week; back stops at the current week). The
    "Add to plan" button is pinned as the sheet footer – it was scrolling
    half off the bottom once the week nav made the sheet taller – and the
    sheet grows to near full-height.
  - **Shopping refetches on tab focus**, so a meal removed on the Plan tab
    always reconciles the week's list even if the realtime event is missed.
    The reconciler and realtime were already correct; the gap was the tab
    having no catch-up path short of app foregrounding.
  - **Edit-item sheet sizing**: hugs its content when the category picker is
    closed (no dead space above Done – the fixed 80% first try padded the
    closed state), grows to near full-height and auto-scrolls the category
    block into view when the picker opens.
  - Shared plumbing: `BottomSheet` gained `minHeightPercent` (0 = hug content)
    and `maxHeightPercent`, and now exposes its scroll position to the sheet
    body via a `useBottomSheetScroll` hook (used for the edit-item auto-scroll).
  All improvised where noted (no Figma frames for these sheets yet), flagged
  per the 2026-07-17 rule. The blessing note above (2026-07-25) that called the
  edit-item sheet "55% minimum height" is now superseded by the hug/auto-scroll
  behaviour.
- **2026-07-28 – the recipe form's save button is pinned to the bottom.**
  Thomas lost edits twice by leaving the form without reaching the button: it
  sat at the very end of the page, below ingredients and instructions, so on
  a real recipe it was several screens down and easy to walk past. It is now a
  footer bar outside the ScrollView (hairline top rule, page background, above
  the tab bar), so "Save changes" is on screen the whole time. Applies to
  adding too – it is one screen, and the same trap exists there.
  **IMPROVISED, flagged per the 2026-07-17 rule**: the Figma add/edit frame
  draws the button at the end of the page and the DS has no sticky-footer
  component, so the bar's rule, padding and background are mine. Worth a frame
  if the pattern is kept, since the same shape would suit any long form.
  Not covered: with the keyboard open on iOS the bar sits behind it – the
  keyboard is dismissed before saving anyway.
- **2026-07-28 – the GitHub account is now `thomassebell`** (was `sebellDS`, a
  leftover from when the Design System was the only thing on it). Done at the
  right moment by luck as much as judgement: the Pages URLs were not yet in App
  Store Connect, and the custom domain had not been set up – renaming after
  either would have meant changing a URL Apple held, or redoing DNS.
  What GitHub does and does not carry over, from its own warning dialog:
  **repository URLs redirect** (so git keeps working), **Pages sites do NOT**,
  and the old profile URL dies. So every `sebellds.github.io/...` link broke
  instantly and permanently.
  Updated: remotes on prepeat, prepeat-web and design-system; the two
  `github.com/sebellDS/...` links in the DS Storybook docs (Architecture.mdx,
  Welcome.mdx – done in a parallel session); this backlog. The DS was otherwise
  untouched: its token pipeline is a LOCAL file copy, it is `private: true` and
  unpublished, and it has no Pages site.
  ⚠️ **`sebellDS` is now unclaimed and anyone can register it.** GitHub's repo
  redirects stop working the moment somebody does. Nothing depends on them any
  more, but do not rely on one.
  Also learned: `sebell` was already taken, and so is `prepeat` – if an
  organisation for the app is ever wanted, `prepeat-app` / `prepeatapp` /
  `getprepeat` / `prepeat-hq` were all free on 2026-07-28.
- **2026-07-28 – how Prep+Eat's email actually works**, written down because it
  is invisible in the repo (all of it is dashboard and DNS) and because getting
  it wrong breaks sign-in for everybody at once. Sign-in is an emailed one-time
  code, so **email delivery is not a side feature – it is the front door**.
  - **Outbound: Resend**, via Supabase Auth's custom SMTP (smtp.resend.com:465),
    sending as **hello@prepeat.app**, sender name "Prep+Eat", minimum 60s
    between codes to one user. Supabase's built-in sender was never an option
    for production – 2 messages/hour, no SLA, and delivery only to
    pre-authorized team addresses. Had that been left on, the app would have
    looked fine for the family and failed for the public on day one.
  - **Free tier ceiling: 100 emails/DAY** (3,000/month, one domain). The
    failure mode when it is hit is total – no code, no sign-in, no workaround
    for the user.
  - **Inbound is the gap.** Resend sends only. People reply to the email in
    front of them, which is the sign-in email, so hello@prepeat.app needs to
    receive mail or support requests vanish silently.
  - ⚠️ **The SPF trap, for whenever a second sender is added** (a mail host, a
    newsletter tool): a domain may have exactly **ONE** SPF TXT record. Adding
    a second one does not add a sender, it makes SPF invalid and codes start
    landing in spam. Both senders go in the one record as two `include:`
    terms. This is the most likely way to silently break sign-in later.
- **2026-07-27 – the error/retry screen is designed, and it is ONE component**
  (Figma 392:11911, Thomas). The first improvisation from July is retired.
  The design: the block centres vertically in the screen body, text
  left-aligned at 40px margins – a 40px `wifi_off` icon, the title in
  text/accent at display-5, the message in text/default, then 24px to a
  full-width "Try again". Built as `src/components/ui/load-error.tsx` and used
  in all three places that can fail to load (launch, Shopping, Plan), which
  settles both open questions: **one shared component**, not three near-copies,
  and **one state** – no "retrying…", no offline-vs-server distinction.
  Thomas's call that only the copy changes per screen, so title and message
  are props. Two notes worth keeping: the frame carries a white bottom rule
  and sits inside the Household screen's list, both artefacts of where it was
  drawn – the rule was dropped on Thomas's word and the surrounding list is
  not part of the component. The copy keeps the app's en-dash over the frame's
  hyphen (writing style).
- **2026-07-27 – never drop a database column in the same round as the code
  change that stops using it.** Migration 0022 broke the Plan tab on every
  phone within the hour, and the reasoning that let it through was recorded
  right here: "the app no longer touches either one, so applying it late is
  harmless". That confused two different things – the REPO had stopped reading
  `pushed_to_list_at`, but the SHIPPED APP (TestFlight build 10) had not, and
  the shipped app is the one talking to the database. Supabase serves every
  installed build at once, and a phone updates days or weeks after a commit.
  The rule from here on, for any DROP or RENAME of a column the client names:
  **ship the client change first, wait until every install has it, drop
  afterwards** – two migrations, weeks apart, not one. When a drop has already
  gone out, restoring the column is the fast repair (0023): it fixes every
  phone at once with no App Store round trip, where a new build takes a
  build + submit + Apple + each tester updating.
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
