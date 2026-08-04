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

Pruned 2026-08-03: the whole "Blocked on other people" section (the TestFlight
tester chase) is gone at Thomas's call – v1.0 is with Apple and no more test
feedback is expected before launch, so chasing the third tester is not work
the launch is waiting on. The diagnostic worth remembering, if a family member
ever "never got the invite": TestFlight tester membership and App Store
Connect TEAM membership are two separate lists, and being on the team sends no
invite. Check betaTesters vs Users-and-Access before blaming email or spam.

## In flight (built, not yet live)

- [x] **Build 14 shipped to TestFlight, VALID (2026-08-03).** Carries the
      leftover move and the two checkbox fixes; cut from the code as it stood
      at 15:39, so the "1 liter / 2 liters" app-side work committed after that
      is NOT in it. **The App Store review is untouched** – v1.0 stays bound to
      build 12.
      **I CALLED THIS WRONG AND IT IS THE LESSON OF THE DAY.** Three submits
      each sat on "Submitting" and were killed by the watchdog at 600s. I
      queried App Store Connect after the third, saw build 13 as newest, and
      concluded "Apple has never received 14" – and wrote it here. Thomas then
      found version 14 on his phone. A re-query showed build 14 VALID, uploaded
      17:06 CEST: one of the "stalled" submits HAD succeeded, the CLI hung
      after the upload rather than during it, and Apple was still processing
      when I looked.
      SO THE OLD RULE NEEDED SHARPENING. "Trust App Store Connect, not the
      CLI spinner" (2026-07-25) is right but incomplete: **ASC's answer is
      also a point in time.** A build missing right after a stall means "not
      processed YET", never "never arrived". The upload lands minutes before
      Apple lists it, so one negative check proves nothing – poll for 10-15
      minutes before concluding anything, and never write a conclusion into
      the backlog off a single query.
      The watchdog is still worth keeping (it stops a genuine 90-minute hang),
      but its message should say "check ASC in a few minutes" rather than
      implying failure. Retrying stays free either way – Apple ignores a
      duplicate upload of a build number it already has.
      Submission ids, if the server-side logs are ever worth reading:
      `031c4a16-7106-4a72-b190-a4379a3daeb0`,
      `59ac675d-75ec-425b-8b8f-be95d71d4908`,
      `8676ad2c-9c50-4481-925d-222237a502c8`.

- [ ] **Move a past week's leftovers to this week** (Thomas 2026-08-03; Figma
      434:7148 "transfer items from last week"). Built the same day it was
      designed. A past week whose list still has unchecked items ends in a
      full-width **"Move all items to this week"**; pressing it empties that
      week onto the current one and offers the undo toast. Graduated out of
      Ideas – the decisions that shaped it are in the log below.
      - [x] **APPLIED 2026-08-03** (`0026_move_week_leftovers.sql`), verifying
            select returned move_fn and undo_fn both true.
            **SAFE FOR THE PHONES** (the 0022 lesson): it only ADDS two
            functions – nothing dropped, no signature changed – so TestFlight
            build 13 is unaffected by it. Note the asymmetry, the usual one:
            the server half is live for everybody now, but nothing can reach
            it until the app half ships in a build, so no phone behaves
            differently yet.
      - [x] **VERIFIED ON DEVICE 2026-08-03** – "it worked perfectly"
            (Thomas, on the dev build installed 14:53). Still only on the dev
            build: it reaches the family with the next TestFlight build.
      - [x] **The pressed state is the DS's, not an improvisation** (checked
            2026-08-03 after Thomas pushed back on it being flagged at all,
            and he was right). `button/solid/fill/*` defines
            enabled #83E651 / pressed #56C91D with the label unchanged at
            #4F4230, and that is exactly what is built. The screen's frames
            not drawing a pressed state is normal – states live on the DS
            component, not on every frame that uses it. LESSON: before
            flagging a component state as a design gap, look it up in
            `ds-theme.cjs` and the DS component; a gap is a state nothing
            defines anywhere, not a state this particular frame did not draw.
      - [x] **PINNED above the tab bar** (Thomas, 2026-08-03), resolving the
            one gap the frames left. They only show short weeks, where the
            button sits at the bottom of the list area either way – but a week
            with twenty leftovers would have hidden it below the fold, the
            same trap the recipe Save button fell into on a long recipe
            (2026-07-28). So it reuses that footer exactly: top border in
            `border/subtle`, the screen's own background so rows scroll under
            rather than through, and the scroll area drops its tab-bar
            clearance while the footer is there. Note the footer chrome itself
            is still undrawn in Figma on both screens – worth a frame if a
            third one ever needs it.
      - [ ] **It inherits known bug 3** (frozen "this week"). The move targets
            the current week as computed at app launch, so an app left open
            across Sunday midnight would push into what is by then last week.
            The server refuses to move backwards, so the worst case is a move
            that does nothing – not a wrong one. Fixing bug 3 fixes this too.

- [x] **Shopping checkbox sat between the two lines of a row** – found by
      Thomas on device 2026-08-03, fixed the same day. The checkbox and the
      text column were centred against each other, so on every row WITH an
      amount the box landed in the gap between name and amount; single-line
      rows looked right, which is why it survived. The design's `checkboxField`
      is `items-start` – box against the name, amount hanging below. The two
      lines also lacked their designed leadings (label 24, hint 16), so the
      name's line box was not 24 tall for the 24-tall checkbox slot to centre
      on, and rows missed the designed 56/72 heights.
      On the dev build only – it reaches the family with the next TestFlight
      build.
      - [x] **Checkbox now binds the forms/* recipe** (Thomas asked for it the
            same day): `forms/background/default` + `forms/border/enabled`
            unchecked, `forms/surface/active` checked – the same group the
            shared text input already uses. Only the unchecked box changes on
            screen; the checked fill is the same #56C91D either way, but the
            right token name is what survives the next DS retune.
      - [x] **NOT A BUG: the square checkbox is the DEFAULT brand.** I read
            the Figma output as specifying radius 0 (it emits a radius for the
            initials badge beside it and none for the checkbox) and flagged
            the app's `radius/xsmall` as a drift. Thomas, same day: "The
            square check box is the default brand, not the Prep+Eat brand."
            The rounded box was right; nothing changed.
            LESSON, the 2026-07-22 one again in a new coat: geometry resolves
            per brand just like colour and type, so the ABSENCE of a property
            in `get_design_context` is as brand-dependent as its value. A
            missing radius is not evidence of radius 0. `ds-theme.cjs` decides.

## Known bugs (open)

- [x] **A plan change that needed MORE than you ticked off was completely
      invisible. FIXED AND APPLIED 2026-08-04 as migration 0028.** Found
      2026-08-04 from Thomas's report: *"it does not update shopping list when
      adding a meal to plan"*, then *"it works in next week but not in
      current"*, then *"it works after I deleted all meals and checked all the
      items in shopping. Then added a new meal."* Those three together are the
      diagnosis: next week's list is empty so new lines appear, while the
      current week's list has been shopped and its lines are CHECKED.
      THE RAILS ARE WORKING AS DESIGNED – the missing half is the UI.
      `plan-shopping.ts` and migrations 0013/0014/0025 all state the rule:
      a checked line is never silently overwritten, and instead *"the shopper
      sees a 'changed in the plan' marker"*, computed as
      `is_checked && sum(contributions) ≠ quantity`. That marker DOES NOT
      EXIST in the app. Verified two ways: `fetchItems`
      ([shopping-list.tsx:405](../src/lib/shopping-list.tsx)) selects explicit
      columns and never touches `shopping_list_item_contributions`, and
      `git log -S contributions -- src/lib/shopping-list.tsx` returns nothing,
      so it was never once read. There is no view or generated column doing it
      server-side either.
      SO THE USER-VISIBLE BEHAVIOUR IS: add a meal, and any ingredient that
      merges into an already-checked line produces no new row, no quantity
      change and no marker – nothing whatsoever. It reads exactly as "the
      shopping list is broken", against listing copy that promises the list
      "builds itself from the plan".
      NOT A REGRESSION from the 2026-08-04 clock work – it has been true since
      the rails landed (0013, 2026-07-16, and decision #8 on 2026-07-25). It
      went unnoticed because a fresh week's list is clean, and demo/testing
      lists rarely have checked items.
      **THE CASE THAT SETTLED IT – Thomas's own week, 2026-08-04.** Plan on
      Sunday; shop on Monday and tick off what is already in the kitchen;
      Tuesday guests arrive, so bump Wednesday's recipe from 4 to 8 servings.
      *"The raised servings does not affect the shopping list."* Every recorded
      contribution doubled and not one line changed, because Monday's shopping
      had checked them all. The app knew he would be short of everything for a
      dinner with guests and showed nothing.
      An earlier argument here – that a shortfall is usually a false alarm
      because you bought a whole pack anyway – DOES NOT SURVIVE THIS, and was
      withdrawn. That holds for a rounding difference; a serving bump is a
      FACTOR, so every ingredient doubles at once and the shortfall is
      proportional and real.
      **FIXED WITHOUT A MARKER, and without any design – but it took two goes.**
      The marker was the wrong frame either way: the question is what a tick
      MEANS (see the sub-item below), so when the requirement rises the line is
      no longer settled and the shopper has to be told.
      - [x] **0028, APPLIED then SUPERSEDED THE SAME DAY. It answered the wrong
            question.** It un-checked the ticked line and put the new TOTAL on
            it. Thomas tested it within the hour: he added "Test 1" (1 litre of
            milk) three times, ticked the merged 3 l off, doubled ONE of the
            three meals – and the list asked for **4 litres**.
            Four is the correct total (1 + 1 + 2). It is the wrong answer: he
            had already accounted for 3, so what he needed was "buy 1 more".
            WHY IT WENT WRONG, and it is the same failure as the display-half
            bug earlier the same day: the choice between showing the TOTAL and
            showing what is OUTSTANDING was noticed while writing 0028 and
            decided silently, in favour of the total, *because it kept 0025's
            bookkeeping simple*. Convenience of the invariant is not a reason to
            hand someone a number they have to do arithmetic against – and the
            trade was never put to Thomas, which is the actual error.
            LESSON: when a choice between two behaviours is noticed during
            implementation, that is a decision, not a detail. Surface it.
      - [x] **0029 is the real fix, chosen by Thomas from three options** (one
            line showing the total; two lines; a new column recording what was
            satisfied). A line holds ONE number and this situation has TWO facts
            – what the plan needs and what the shopper already secured – so they
            get a line each. The ticked line is never touched again, and what is
            still missing appears as its own active line: "3 l [ticked]" plus
            "1 l".
            THE NUMBER WAS ALREADY IN THE DATA, which is what made it cheap:
            0025 gave every contribution both `quantity` (what the meal needs)
            and `applied_quantity` (how much is folded into the visible line),
            so *still needed* is just
            `SUM(quantity - coalesce(applied_quantity, 0))`. Nothing new is
            recorded; it is a query.
            RECOMPUTED, NEVER INCREMENTED – this is the part that makes the
            reverse operations work, and where an incremental version would rot.
            Un-double the meal and the sum returns to zero, so the extra line
            removes itself. Every path was walked in simulation before the SQL
            was written: un-double, double two, remove the meal, and – the one
            that catches naive versions – tick the extra litre off and then
            double a SECOND meal, which correctly asks for 1 more rather than 2.
            It also fixes Thomas's original report ("adding a meal to plan does
            not update the shopping list") through the same mechanism.
            0029 REVERTS 0028's un-freezing in both reconcilers, back to 0025's
            rails exactly. The rails were never the problem; the missing half was
            that nothing told the shopper.
      Hand-edited lines are still never overwritten, and a DECREASE still never
      disturbs anything – the sum simply drops.
      - [x] **WHAT A TICK MEANS, and it is not "I bought this"** (Thomas,
            correcting a first draft of 0028): *"the recipes add something to
            shopping. then the human checks whats in the kitchen, then goes
            shopping."* So a tick is a JUDGEMENT – "I have enough for what this
            line says" – made against a specific amount. When the plan raises
            that amount the judgement is stale, and whether the cupboard still
            covers the new number is something only the person who looked in it
            can say. Un-checking hands it back to them. That is the entire basis
            of the rule, and it is why the fix needs no marker.
      - [x] **NO EXCEPTIONS BY KIND OF ITEM – a first draft had one and it was
            wrong.** That draft carved out seasoning-scale units (tsp, tbsp,
            pinch…) so salt and pepper would not keep returning. Thomas rejected
            it: *"I don't think we can make exceptions like that. what if people
            don't have salt and peber."* He is right – it hardcodes an
            assumption about what a household stocks, and the app cannot know
            that for a spice any more than for mince. It would be the app
            guessing on the household's behalf, quietly. The uniform rule
            assumes nothing, and the churn is small and comprehensible: it
            happens only when someone CHANGES a meal, a deliberate act they just
            performed, and re-ticking a line is one tap.
            It also turns out the common case is handled for a principled
            reason rather than a guess: "salt and pepper to taste" parses to NO
            amount, and every path here requires one, so those lines never come
            back at all.
            LESSON: an exception that encodes a guess about the user's world is
            worse than the churn it saves. When the app cannot know, ask the
            person who can.
      - [ ] **Learned pantry, the proper way to make it quieter about staples.**
            A per-household "I always have this", the same teach-it-once shape
            as `item_category_memory` (decision #7) and a close sibling of
            Teach-a-synonym under Later. The household TELLS the app; the app
            never guesses. Only worth building if the re-ticking actually proves
            annoying in real weeks.
      - [x] **0028 APPLIED 2026-08-04** (all four columns true), then corrected
            by 0029 the same day – see above. **Live for everybody already** – a
            database change reaches every phone the moment it runs, so builds 12,
            13 and 14 all behave this way now, with no app change needed.
      - [x] **0029 APPLIED 2026-08-04**, verifying select returned all six
            columns true (outstanding_column, sync_fn, contribute_is_0029,
            rescale_is_0029, withdraw_is_0029, unfreezing_gone). That last one
            reads `prosrc` to prove 0028's un-freezing is gone from the live
            body, not merely that the function exists. **Live for everybody
            already**, builds 12/13/14 included, with no app change needed.
      - [x] **0030: "Clear done items" switched the whole thing off** (Thomas,
            same day, testing 0029 within the hour): *"if I clear all marked item
            in shopping, the logic collapses and nothing is shown if I change
            servings."* Right, and it was one line – 0029's sync opened with
            `if not found or v_line.deleted_at is not null then return`, and
            clearing the done band soft-deletes those rows. So every later plan
            change found a deleted line and bailed before computing anything.
            THE GUARD READ "deleted" AS "no longer relevant", when CLEARING IS
            THE STRONGEST FORM OF SATISFIED – the shopper ticked it off and then
            swept it away because it was handled. The requirement it covered did
            not go anywhere, so the difference is still owed.
            0030 fixes both halves of that confusion: bail only when the row does
            not exist or is NOT TICKED, and count a ticked outstanding line as
            satisfied whether or not it was later cleared (without the second
            half, clearing the done band twice would ask for an already-bought
            litre all over again).
            LESSON, and it is the third time today in a different costume: this
            is unreachable without three or four steps of setup, so nothing but
            a real walk-through finds it. Two migrations passed their verifying
            selects and neither said anything about this.
      - [x] **0030 APPLIED and CONFIRMED ON DEVICE 2026-08-04** – Thomas walked
            the 3x "Test 1" case with a clear in the middle (tick the merged 3 l
            off, Clear done items, double one of the three meals, un-double it)
            and reported *"it works now"*. **Live for everybody**, builds 12, 13
            and 14 included, with no app change needed.
            Three of 0030's fixes came from the state grid rather than from
            testing, and none of them would have been reachable by hand without
            several steps of setup: a hand-edited outstanding line being
            overwritten, a shopper-deleted one coming back, and sync's own
            tombstones counting as "already bought" so that un-doubling then
            re-doubling showed nothing.
            Worth copying from this one's verifying select: the last two columns
            read `prosrc like '%0028%'` to prove the new BODIES landed. A
            replaced function body is invisible to an `exists in pg_proc` check,
            which every earlier migration's select relied on – so those could
            have passed on a file that never ran its `create or replace` at all.
      **The marker itself is now moot for this gap, but the finding stands**: no
      client has ever read `shopping_list_item_contributions`, so if a marker is
      ever wanted for the cases 0028 deliberately leaves alone – a decrease, a
      hand-edited line, a pantry unit – it still has to be designed and built.

- [ ] **The same ingredient can still appear twice on the shopping list**
      (Thomas, 2026-07-29, looking at the week-32 demo list: *"a lot of item
      are the same, but named differently"*). `item_merge_key` (migration
      0013) originally was `norm_item_name(name) || ' ' || lower(trim(unit))`,
      so two rows merged only on an exact name AND an exact unit string. The
      mechanical halves are fixed (trailing unit words lifted out of the name,
      spelled-out units folded onto abbreviations). One cause remains:
      - [x] **Singular vs plural count units – DONE, and the "needs a decision"
        note here was stale.** Migration 0024 (2026-07-30) already singularises
        the unit INSIDE `item_merge_key`, exactly as this entry proposed, so
        clove/cloves, cup/cups, slice/slices and head/heads merge while the row
        still prints whichever natural form was stored first. The decision was
        therefore made and shipped three days before this entry was last read
        aloud on 2026-08-03; 0024's rule then needed one correction of its own,
        which is item 8 of the pre-build audit below.
        LESSON: a bug entry that proposes a fix has to be re-read when the fix
        lands, or it goes on asking for a decision that has already been made.
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
- [x] **2. FIXED AND APPLIED 2026-08-03 (migration 0025). Shopping quantities
      drifted wrong when a line was checked/unchecked around a plan change.**
      `supabase/migrations/0013_atomic_plan_push.sql`
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
      DONE, as `0025_contributions_track_what_was_applied.sql`: a new
      `applied_quantity` column records the amount ACTUALLY folded into the
      visible line (null = none), and withdraw/rescale reverse that instead of
      the raw quantity – so a debit can never exceed the credit that was made.
      Invariant restored: a line's quantity is the sum of its live
      contributions' `applied_quantity`, plus whatever the user owns.
      Chosen over "recompute the line from its contributions on every change"
      because checked, hand-edited and manually-added lines are deliberately
      frozen (0013's rails, decision #8) and a full recompute would overwrite
      amounts the user owns. Existing rows backfill `applied_quantity =
      quantity`, which is exactly today's behaviour, so applying the migration
      cannot itself move a single number.
      **SAFE FOR THE PHONES** (the 0022 lesson): it only ADDS a column and
      replaces function bodies – no signature changes, nothing dropped – so
      TestFlight build 12 keeps working unchanged.
      - [x] **APPLIED 2026-08-03**, verifying select returned all four columns
            true (applied_column, backfilled, withdraw_fn, rescale_fn).
            **This one IS on everybody's phone already** – a database change
            reaches every client the moment it runs, unlike app code which
            waits for the next build. So #2 is fully fixed for the family and
            for TestFlight build 12, while #1, #5 and #6 are still only on the
            dev build. That asymmetry is the code-vs-live distinction the
            2026-07-27 outage taught, running in the good direction for once.
- [x] **3. FIXED 2026-08-04 (NOT YET WALKED ON A DEVICE – see below).
      "This week" was frozen at app launch, so a meal could land on last
      week.** [src/lib/shopping-list.tsx](../src/lib/shopping-list.tsx)
      and [src/lib/meal-plan.tsx](../src/lib/meal-plan.tsx).
      Both providers computed the current week ONCE at mount (empty-dependency
      useMemo) and never recomputed. Returning to the foreground called
      `refresh()`/`retry()`, neither of which recomputed the week. Leave the
      app open across a week boundary (Sunday night → Monday) and it still
      treated the finished week as "this week" – so a meal added to what looks
      like the current week actually landed on the PREVIOUS week's plan and
      list.
      DONE as ONE shared clock, [src/lib/use-today.ts](../src/lib/use-today.ts)
      (`useTodayKey` + `useCurrentWeekStart` derived from it), rather than the
      same wiring in two providers and `new Date()` in three components.
      - **The audit's suggested fix was not enough, and this is the
        interesting part.** It said "recompute on the AppState active handler
        and inside refresh()". But `active` only fires when the app COMES BACK,
        and the bug as written is about an app *left open* – which never
        backgrounds, so `active` never fires and nothing would have recomputed.
        The suggestion fixes the overnight-and-reopened case and misses the
        literal one. The clock therefore does both: a foreground handler AND a
        tick.
      - **⚠️ THE REACT COMPILER FREEZES `new Date()` IN A RENDER BODY. Read
        this before writing any date-dependent UI.** Found 2026-08-04 when
        Thomas tested the fix: the week rolled over correctly at 00:00 and
        Monday was NOT marked as today. `reactCompiler: true` (app.json)
        memoizes render-body expressions by their reactive inputs, and
        `toDateKey(new Date())` has NONE – so it is cached for the lifetime of
        the component and never recomputed, however many times that component
        re-renders. It LOOKS like live code and behaves like a value frozen at
        mount. This is the documented React Compiler caveat about impure render
        code (`Date.now()`, `Math.random()`), and it means an earlier note in
        this very entry was WRONG: three components were dismissed as safe
        "because they recompute on every render", and none of them did.
        Fixed at [(plan)/index.tsx](../src/app/(plan)/index.tsx) (the day
        highlight), [week-bar.tsx](../src/components/plan/week-bar.tsx) (which
        day cells are greyed out as past) and
        [add-to-plan-sheet.tsx](../src/components/recipes/add-to-plan-sheet.tsx)
        (which DAY a meal lands on, and the floor for navigating back) – all
        three now take the clock from the hook.
        THE RULE: never read the clock during render. It is not live, whatever
        it looks like. Take it from `useTodayKey`/`useCurrentWeekStart`.
      - **One clock, two values, so they cannot disagree.** The week is derived
        from the day key rather than read separately – the inconsistency Thomas
        saw (week says Monday, highlight says Sunday) is structurally
        impossible now. It is one module-level ticker with
        `useSyncExternalStore`, so every consumer changes on the same tick and
        the app has ONE timer rather than one per component.
      - **The tick is dumb and short (10s), after the first version failed on
        the phone.** That version scheduled a single timer to land exactly on
        midnight, capped at 15 minutes so React Native never saw a multi-day
        `setTimeout`. The flaw: a timer fires after that much REAL time has
        passed and knows nothing about the wall clock moving underneath it.
        Thomas set the phone's clock forward to Sunday 23:58 with the app open,
        and the pending timer still had its original delay to run – simulated
        against the real `week.ts`, it would have rolled over at **00:11**,
        eleven minutes late. Not merely a test artifact: a phone coming back
        from being switched off, or correcting itself against the network, jumps
        its clock the same way. Re-reading the clock every ten seconds has none
        of that cleverness and none of its failure modes; the cost is a date
        read and a string compare six times a minute, foreground only, and
        nothing is notified unless the day actually changed.
        The `msUntilNextWeekStart` helper the clever version needed was deleted
        rather than left behind as dead code.
      - **Who follows a roll-over.** Someone looking at what used to be "this
        week" is moved onto the new one: that is the week they think they have
        open, and where a meal they add should land. Someone who had
        deliberately navigated BACK to an older week stays there – it simply
        stops being current, and on Shopping "Move all items to this week"
        appears for it like any other past week.
      - **The two providers do it differently, on purpose.** Shopping reuses
        `viewWeek`, which resolves the week's list against the SERVER
        (`getOrCreateListId`). Plan cannot: its `viewWeek` looks the week up in
        the weeks list already in state, and a plan another phone created for
        the new week is not in it yet – so Plan re-runs its boot instead, which
        already is "load the weeks, THEN load the viewed week's entries". It
        bumps `bootAttempt` only, never `retry()`, so the Live badge is left
        alone; nothing about a new week says the connection changed.
      - **The boot effects no longer depend on the week.** They read it from a
        ref instead, so a boundary crossed mid-session cannot re-run them (a
        re-run would have swapped the visible list out from under a shopper).
        The same ref is what makes a "Try again" pressed AFTER a roll-over
        resolve the NEW week rather than the one the provider mounted on.
      - **This also fixes the leftover-move's inherited copy of this bug** –
        the "Move all items to this week" note under In flight. The move target
        is now the live week, so it can no longer aim at a week that has since
        become last week.
      - [x] **The week roll-over itself is CONFIRMED ON DEVICE 2026-08-04**
            (Thomas, clock set to Sunday 23:58): *"it switched on 00:00 to a new
            week"*. The day highlight was the same test's second finding, fixed
            above.
      - [x] **Verified off-device, the parts that can be.** The shared clock was
            run headless against the real `use-today.ts` and `week.ts` under
            TZ=Europe/Copenhagen, with a stubbed AppState and a controllable
            clock – 18 checks: the day turns at midnight and the week turns with
            it, day and week always agree, nothing is notified on a day that did
            not change, a second consumer reuses the one ticker, the ticker
            stops only when the last consumer unmounts, a foreground catches up
            a week-old clock, and a remount re-syncs a stale module value.
            Typecheck and lint clean.
      - [ ] **WALK ORDINARY USE ON THE DEVICE.** Still unproven, and the
            2026-08-03 retry-button lesson says this is exactly the class of
            code review passes and use breaks: that normal operation survived
            the effect-dependency surgery in both providers – open both tabs,
            switch weeks, add and remove a meal, force-quit and reopen.
      - [x] **A RACE THIS INTRODUCED, found and fixed 2026-08-04 while chasing
            something else.** The first version had the roll-over call
            `viewWeek` on the shopping side. That starts a SECOND chain
            alongside a boot that may still be in flight, and the boot is four
            round trips deep against viewWeek's two – so the boot lands LAST
            and puts the old week's `listId` and items under the new week's
            label. The list then looks fine while quietly belonging to the
            wrong week, and a meal added to the current week contributes to a
            list that is not on screen.
            Fixed by having the roll-over RE-RUN THE BOOT (bump `bootAttempt`)
            instead: React runs the previous run's cleanup first, which sets its
            `cancelled` flag, so the older chain drops itself. One code path,
            no race, and it now matches what the plan provider does.
            A guard was added to the boot as well, for the case
            `bootAttempt` cannot cover: a `viewWeek` does NOT cancel an
            in-flight boot, so a week switched during a slow boot would
            otherwise be overwritten by it.
            NOTE this was NOT what Thomas was reporting – that turned out to be
            the missing "changed in the plan" marker, first item under Known
            bugs. The race is real but was found by reading the code, not from
            the symptom. LESSON: a plausible mechanism that explains the
            symptom is not the same as the cause. The thing that separated them
            was evidence – `git log -S` proving the marker was never built –
            not more reasoning about the mechanism.
- [x] **4. FIXED 2026-08-04. Imported text showed raw codes, and some amounts
      vanished.** [src/lib/recipe-import.ts](../src/lib/recipe-import.ts).
      `cleanText` decoded NUMERIC HTML entities but only six named ones, so
      `&rsquo;` `&eacute;` `&ndash;` survived as gibberish in titles, steps and
      ingredient names. Worse, `&frac12;` was not folded to ½ and the amount
      parser is ASCII-only, so `&frac12; cup sugar` failed to match a leading
      amount and was stored as the NAME with no quantity – the amount silently
      lost on the shopping list. Mostly sites using the microdata/meta fallback
      rather than the dominant JSON-LD path.
      DONE: a curated `NAMED_ENTITIES` table (~110 – Latin-1 in both cases,
      punctuation, all 15 fractions, symbols) read by ONE pass, replacing the
      six hand-written replaces. An entity NOT in the table is left VISIBLE
      rather than swallowed, so the next unknown one is obvious instead of
      mysterious. The fraction half needed nothing else: `&frac12;` → ½ meets
      the vulgar-fraction folding already built on 2026-07-29, so
      `&frac12; cup sugar` now parses as quantity "1/2 cup", name "sugar".
      TWO ORDERING RAILS, both commented in place because both are traps:
      `&amp;` is decoded LAST and deliberately kept OUT of the table, or a
      literal `&amp;#39;` would become an apostrophe it never was; and numeric
      entities are decoded BEFORE the named pass for the mirror-image reason.
      Invisible characters (`&shy;`, `&zwnj;`, `&zwj;`) are dropped rather than
      decoded – one inside an ingredient name would travel into
      `item_merge_key` and split a shopping row for no visible reason.
      - [x] **Verified by running the REAL module, not a mirror** – the lesson
            from the reconciler rounds. `recipe-import.ts` has zero runtime
            imports, so `npx tsc --ignoreConfig` on that one file produces a
            module node can import, and the actual `splitIngredient` was
            exercised over 20 cases: every fraction entity, accented text in
            three languages, the established rails (`400 g cherry tomatoes`,
            `2 fed hvidløg`, ranges, numeric entities), and the awkward ones –
            an unknown entity stays visible, a double-escaped ampersand is not
            decoded twice, a soft hyphen never reaches a name. Typecheck and
            lint clean. **Worth reusing: that transpile trick makes any
            import-free lib module directly testable.**
      - [x] **Dashes joined the trailing-punctuation strip**, beyond the
            reported symptom and flagged rather than slipped in. The case grid
            showed `beef – diced` leaving `beef –` on the list: the comma-less
            prep cut takes the prep word and left the separator. Pre-existing –
            it happens with a literal dash too – but decoding `&ndash;` made it
            visible. `beef – Wagyu` is untouched, since only a DANGLING
            separator is removed.
      - [ ] **App code, so it needs a build.** Nothing about this is live for
            any phone until the next EAS build; existing recipes imported before
            it also keep their old text (see the re-import gap under Code
            debts).
- [x] **5. FIXED 2026-08-03. Three screens could strand the user on an endless
      spinner.**
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
      simply never applied here.
      DONE, all three reusing the designed `LoadError` (Figma 392:11911), no
      new UI invented:
      - **Recipes tab** – a failed FIRST load now offers a retry. A later
        refocus that fails deliberately KEEPS the recipes already on screen
        instead: stale rows beat an error block over content that is still
        good.
      - **Recipe detail** – both the loading and the error state now carry the
        header, so there is always a Back button. Without it a failed load
        (offline, or a recipe another member just deleted) left the screen
        with no way out at all.
      - **Shopping week switch** – the real fix was in the provider, not the
        screen. The error condition was `loading && live === 'offline'`, which
        INFERRED failure from being offline and so missed every server-side
        failure (the 2026-07-27 outage shape) – the list just went blank, no
        spinner, no message. `shopping-list.tsx` now has a real `failed` flag
        set by the catch blocks of both the boot load and `viewWeek`, and
        retry reloads the VIEWED week rather than silently dropping the
        shopper back onto the current one.
      **CONFIRMED ON DEVICE 2026-08-03** (dev build, `app.prepeat.dev`) –
      screenshots of all three retry screens, Thomas: *"both works now"*. Not
      on any tester's phone until the next EAS build.
      Two follow-ups came straight out of that testing, both now fixed:
      - **Shopping had no loading state at all.** The list area just stayed
        blank while loading – a deliberate choice (a code comment explained it
        avoided flashing the empty state at a household that has items) with
        the wrong solution, since blank is indistinguishable from broken.
        Plan and Recipes both spin; Shopping now matches, guarded on an empty
        list so a background refresh never replaces rows with a spinner.
      - **"Try again" looked dead on the launch-failure path.** It kicked off
        a reload but never cleared `failed`, so the badge flipped to
        "Connecting" while the error block sat there unchanged. Introduced by
        the `failed` flag above – a new state with no loading state to fall
        back to. `retryLoad` now dispatches `begin-load` first.
      **The lesson, and it is the recurring one:** both were found by Thomas
      in two minutes on the device and by nobody in review – the audit, the
      typecheck, the lint and the adversarial verifiers all passed code whose
      RETRY BUTTON DID NOTHING VISIBLE. Error paths are exactly the code that
      is never exercised by ordinary use, so "it compiles" says almost nothing
      about them. Walk them on a device.
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
      **CLOSED 2026-08-02 – the improvisation flag was withdrawn, correctly.**
      It was raised because no Figma frame exists for the fixed state, and
      Thomas challenged it: *"didn't we just fix that with making the text
      color text/default"*. He is right, on both counts the flag rested on:
      - **It was never an invention.** The 2026-07-17 rule exists to stop
        Claude's improvisation passing as Thomas's design. `text/default` is
        what [invite-someone-sheet.tsx:145](../src/components/household/invite-someone-sheet.tsx)
        ALREADY used for the very same code – so this change made two screens
        agree with a decision Thomas had already made, rather than inventing a
        third treatment. Matching an existing design is not improvising.
      - **"It now reads like body text" was wrong**, and the on-device
        screenshot settles it: 32px, emphasized, centred in its own chip with
        a copy icon. It reads as a code.
      A filled brand chip (white on #378112, 4.87:1) was measured and would
      also work, but that is an ENHANCEMENT IDEA, not an outstanding defect –
      logged under Ideas, not carried here as unfinished work.
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
- [x] **8. FIXED AND APPLIED 2026-08-03 (migration 0027). `liter` and `liters`
      split into two shopping rows, a regression from migration 0024.** `supabase/migrations/0024_merge_key_ignores_unit_
      plural.sql`:61. The unit normalizer stripped a trailing `s` OR `r` to
      merge duplicates. That fixes clove/cloves but breaks any unit whose
      singular ends in r: `liter` → `lite` while `liters` → `liter`, so
      "1 liter milk" and "2 liters milk" never merge. Same shape for
      jar/jars and container/containers. Narrow but it shipped on 2026-07-30,
      three days before this audit.
      THE `r` WAS NOT A TYPO, which is why the fix needed a decision rather
      than a revert: Danish plurals end in -r (dåse → dåser, pakke → pakker),
      so that half was doing real work. English singulars can end in r and
      Danish plurals do, so no single letter rule serves both languages – the
      two cases have to be told apart by name.
      DECIDED 2026-08-03 (Thomas, option A of three offered): keep a blanket
      strip for the English plural `s`, and handle the Danish -r/-er plurals
      with a short explicit list. Rejected: a full unit map in SQL (a longer
      list to keep in step with the client's for no extra coverage today), and
      leaving it alone (cheap, but the fix is one small migration).
      Blanket s-stripping is safe even on the Danish units that END in s, and
      this is why the s half of 0024 never caused trouble: `glas` and `ris` are
      the same word in the plural, so both forms fold to the same key whatever
      the rule does to them. Only a rule that folds singular and plural
      DIFFERENTLY splits a row.
      DONE as `0027_merge_key_plural_s_only.sql`. It also fixes four cases 0024
      got wrong that nobody had noticed: the English sibilant plurals
      (`pinches` → `pinche`, and the same for bunches/dashes/boxes) now lose
      the whole `es`. 0024's deliberate `gr` → `g` fold is carried over
      explicitly so legacy gram rows keep merging.
      **SAFE FOR THE PHONES** (the 0022 lesson): it replaces a function BODY
      only – no signature change, nothing dropped – and `item_merge_key` is
      called at runtime rather than stored in a column or an index, so there is
      nothing to reindex. Builds 12 and 13 keep working and pick up the better
      merging the moment it runs, because the merge happens on the server.
      - [x] **APPLIED 2026-08-03**, verifying select returned all eight columns
            true (liter_fixed, jar_fixed, container_fixed, cloves_still_merge,
            danish_still_merges, pinches_now_merge, legacy_grams_kept,
            short_units_untouched). **This one IS live for everybody already** –
            a database change reaches every phone the moment it runs, so builds
            12 and 13 both merge liters correctly from now on.
      - [x] **The DISPLAY half landed too, 2026-08-03** (Thomas asked for it
            after the migration): `UNIT_SINGULARS` in
            [src/lib/quantity.ts](../src/lib/quantity.ts) is what turns a
            plural into a readable singular at "1", and it had the same gap –
            an item stored as "liters" and scaled down to 1 printed
            "1 liters". Added the r-ending singulars (liter, litre, jar,
            container), the remaining English plurals a recipe uses (bags,
            packs, boxes, dashes, glasses) and the Danish ones, since the UI
            language is English but the recipes are not.
            NOTE THESE ARE TWO LISTS DOING TWO JOBS, not a duplication to
            collapse: this one produces text a shopper reads, `norm_item_unit`
            produces a key nobody ever sees. Kept in the same shape so adding
            a missing unit is one obvious edit in each. **App code, so it is on
            the dev build only** – unlike the migration, it needs a build.
            Known limit, not fixed: a multi-word unit never matches either list
            ("2 liters milk" typed wholly into the quantity field stays
            "1 liters milk"). Not reachable today, because name and quantity
            are separate fields; it becomes real if the "Milk 2L" smart-parsing
            idea is ever built.
      - [x] **AND THE OTHER DIRECTION, which is the common one** – found by
            Thomas on the device within minutes of the build above: a recipe
            storing "1 liter milk" doubled to x2 servings read "2 liter". The
            fix above only ever turned a plural INTO a singular at 1; nothing
            put the s back at 2, so scaling a recipe – the everyday action, far
            more common than editing an amount down to 1 – was the case left
            broken. `formatQuantity` now uses `UNIT_PLURALS`, derived by
            INVERTING `UNIT_SINGULARS` so the two directions cannot disagree
            and a new unit is still a one-line edit. Abbreviations are absent
            from both lists, which is what keeps "2 g" and "2 tsp" from growing
            an s, and so are the Danish invariants (glas, ris, fed).
            LESSON, and it is the 2026-08-03 retry-button one wearing a
            different hat: a fix aimed at the symptom that was REPORTED can
            leave the same defect standing in the direction nobody mentioned.
            "1 liters" was the example given, so that is what got fixed and
            what got tested – 14 units checked at quantity 1, none at 2. The
            question worth asking before calling a display fix done is what the
            value is the REST of the time, not just at the one value in the
            bug report.
      - **It does not repair existing rows**, same as 0024: this changes how
        rows are MATCHED from now on. A week's list that already holds milk
        twice keeps holding it twice until that week is rebuilt (remove the
        meals and add them again). New weeks merge correctly.
      - **Two-stage verification, worth copying** – there is no local Postgres
        on the Mac, so the fold RULE was proved first by mirroring it in Python
        and running it over every unit the importer knows plus the Danish ones
        (all 36 singular/plural pairs merge, no two unrelated units collide,
        and g/kg/ml/dl/l/oz/tsp/tbsp/stk/tsk/spsk/fed are untouched). That is
        what caught the `pinches` → `pinche` case 0024 also got wrong. The SQL
        itself was proved only by the verifying select above. Neither step
        substitutes for the other: the simulation cannot catch a syntax error,
        and an all-true select on three examples would not have found pinches.
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

**Verification of the 1 + 6 fixes: CONFIRMED ON DEVICE 2026-08-02.** Typecheck
and lint clean, every NativeWind class checked to exist elsewhere in `src/`
(worth doing explicitly – `tsc` does NOT catch an invented class name, so a
typo fails silently at runtime as unstyled text), then built to Thomas's
iPhone with `./scripts/build-iphone.sh` and walked through. Finding 6 is
evidenced by a screenshot of the real "… is ready" screen: the code renders in
dark `text/default`, not lime. Thomas: *"everything checks out"*.
Note this is the **dev build** (`app.prepeat.dev`, 2026-08-02), NOT a numbered
TestFlight build – neither fix is on any tester's phone until the next EAS
build ships. Per the definition-of-done rule from
[lessons-from-building-prepeat.md](lessons-from-building-prepeat.md) that
distinction is the whole point: verified ≠ delivered.

Two things learned while verifying, worth keeping:
- **The invite-code screen is FIRST-RUN ONLY.** Creating a household from the
  switcher (`create-household-modal.tsx`) goes straight to a Welcome screen
  with no code – you get the code afterwards from Household → Invite someone.
  Only a brand-new account with no household sees the onboarding "… is ready"
  panel. Claude's first test instructions sent Thomas down the switcher path
  and wasted a throwaway household.
- **The everyday invite sheet was already correct.**
  [invite-someone-sheet.tsx:145](../src/components/household/invite-someone-sheet.tsx)
  already rendered the code in `text/default`, so the lime was only ever on
  the first-run screen and the fix makes the two paths agree rather than
  inventing a new treatment. The sweep also confirms `text/link` now appears
  exactly ONCE in the app – see the wordmark question below.

- **DECIDED 2026-08-02: the wordmark full stops STAY lime, and the app is not
  touched.** [src/components/onboarding/onboarding-flow.tsx:388](../src/components/onboarding/onboarding-flow.tsx)
  renders the periods in the stacked welcome wordmark (*prep. cook. eat.
  repeat.*) in `text/link` #56C91D – the last use of that token in the app.
  Left alone on purpose: it is Thomas's design (the code comment cites the
  Figma frame "household set up 5" – each word subtle, each period lime),
  WCAG explicitly exempts logotypes and brand names from contrast minimums,
  and the periods carry no information anyway – the words are #5F503A and
  legible with or without them. Thomas: the token work belongs in the DS
  project, not here. See the DS nit under Code debts for the shape of it.
  Not re-flag this in a future audit.
  One thing never checked, aesthetic rather than compliance: the wordmark sits
  on `welcomePhoto` (an ImageBackground), so the real contrast of those lime
  periods varies with the photograph behind them. Only Thomas's eye settles
  whether they hold up.

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
      **The TOKEN is still wrong, and the fix is a SPLIT – not a retune.**
      HANDED TO THE DS PROJECT 2026-08-02 (Thomas: *"this is a bigger token
      rewrite in the DS. Leave it for now and I will fix it in the DS
      project"*). Nothing more happens in this repo until the DS ships it;
      the app then picks it up on the next `npm run sync-ds-tokens`.
      WHY A SPLIT. `text/link` is doing two incompatible jobs: "this is
      tappable" (needs to be dark enough to read – #56C91D is 2.15:1 on white,
      a real accessibility defect) and "this is the brand" (the lime full stops
      in the welcome wordmark, which want to stay bright). Retuning the single
      token fixes links and silently darkens the brand mark – trading one
      problem for another, and the kind of change nobody notices until it has
      shipped.
      THE SHAPE, which needs no invention because the website already solved
      it: links there use `text/brand` #378112 with an underline, precisely
      because lime failed on white. So –
      - links point at `text/brand` (#378112, measures 4.55:1 on #F8F7F7 and
        4.87:1 on white – already the website's answer),
      - lime #56C91D survives unchanged under a name that says what it is for
        (a brand accent, not a link),
      - the wordmark periods point at THAT, and the welcome screen looks
        identical to today.
      Until it lands, any NEW use of `text/link` in the app reintroduces the
      defect – the app currently has exactly one, the wordmark, which is
      exempt (see the decided item under the pre-build audit).
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

- [ ] **A second, free Supabase project as a DEV environment** (Thomas
      2026-08-04, wants to decide later – logged so the reasoning is not
      re-derived). Today every dev run reads and writes the household's REAL
      data; a test recipe invented at 11pm appears on his wife's phone.
      **THERE IS NO BLOCKER. This is a cost/benefit call, not a technical one** –
      I first recommended waiting, and that was me weighting Thomas's
      complexity fatigue heavily an hour after he said the setup had got out of
      hand. He may weigh it differently, and that is a reasonable call.
      **WHY A CLOUD PROJECT RATHER THAN THE LOCAL DOCKER ONE.** This reverses
      the morning's decision, on a constraint Thomas raised: **his phone is not
      always on the same wifi as the Mac** (mainly at work), and local Supabase
      can only ever serve a device on the same network. A cloud database is
      reachable from anywhere. Local Docker stays for migration replay, which
      needs no network and is the genuinely dangerous part.
      **THE ONE THING THAT MUST BE RIGHT AT CREATION TIME: put the dev project
      in a SEPARATE ORGANISATION from production.** Supabase bills per
      organisation, so a dev project sitting alongside production starts
      costing $10/mo the day production goes Pro. In its own Free organisation
      it is free permanently. Easy now, annoying later.
      **The three costs, weighed:**
      1. Migrations get applied twice, dev first. Barely a tax – that ordering
         IS the test.
      2. A free project pauses after a week unused; restoring is a click and a
         couple of minutes.
      3. A third environment – but Thomas does not hold it, this file and
         CLAUDE.md do.
      **Two things to know before starting:**
      - **Sign-in.** Live OTP email goes through Resend, configured on
        production only. A dev project falls back to Supabase's built-in
        sender, which on the free plan delivers only to addresses on the
        project – so Thomas could sign in, family members could not. Fine for
        dev.
      - **Dev starts empty.** Better than restoring a production backup into
        it: that would spread real user emails into a second cloud project for
        no benefit. Make a test household instead.
      **The end state:** `.env` on the Mac points at DEV, so everything run
      locally and every build on Thomas's own phone is dev. EAS keeps its own
      variables, so **TestFlight and the App Store stay on production**. One
      rule, and the safe option is the default.
      **SUPABASE PRO DOES NOT SOLVE THIS** (Thomas asked, 2026-08-04; checked
      against Supabase's own docs rather than answered from memory). Pro
      protects ONE project – backups, capacity, support. It buys no second
      database.
      **Supabase BRANCHING was evaluated and rejected**, so it does not get
      re-proposed: it needs Pro or above, and although there is no fixed fee,
      usage runs ~$0.0134/hour on default compute – a permanently-up branch is
      ~$10/mo, the same as simply adding a project. Worse, it is built around
      pull requests (preview branches pause when idle and are DELETED when the
      PR closes; Thomas does not work in PRs), **every branch has its own URL
      and keys, so pointing an iPhone at one means a new build each time**, and
      branching is explicitly NOT covered by the spend cap.
      **So the two decisions are INDEPENDENT.** A dev project in its own Free
      organisation stays free whether or not production ever goes Pro – either,
      both or neither is coherent.
      **Related trigger:** the argument becomes overwhelming at the same moment
      as the Supabase Pro one – real users who cannot be phoned, at which point
      "I was just testing" stops being an acceptable explanation. Same trigger,
      so decide them in one sitting; but one does not buy the other.

- [ ] **The app is unusable offline, and the shopping list is where that
      hurts** (found 2026-08-03 by Thomas testing the retry screens).
      Force-quit the app, lose signal, reopen: you get "Can't reach your
      kitchen" and nothing else – no plan, no recipes, and no shopping list.
      Confirmed in code: `AsyncStorage` holds only the auth session, the
      active household id and a one-time legacy-prefs migration. **No recipe,
      meal plan or shopping item is cached on the device**; every screen
      fetches from Supabase on each launch.
      WHY IT MATTERS more than it looks: the shopping list is the one screen
      used standing in a shop, which is exactly where signal is worst, and iOS
      evicts backgrounded apps routinely on a long trip. While the app stays
      in memory everything is fine – the failure needs a force-quit or an
      eviction, which is not constant but is not rare either.
      NOT A DEFECT – every error path behaves exactly as designed, which is
      why the pre-build audit did not flag it. It is a product assumption
      (the app assumes it is online) with no last-known-good fallback.
      A real offline mode is significant work and touches the sync model
      (last-write-wins via `updated_at`, realtime merges), so this is logged
      as a known limitation rather than a task. A cheap first step, if it ever
      bites: cache just the CURRENT week's list and show it read-only when the
      load fails, which covers the in-the-shop case without touching sync.
      Worth a decision before the family relies on it weekly.
- [ ] **Invite code as a filled brand chip** (measured 2026-08-02, not
      committed to). White on #378112 clears AA at 4.87:1 and would make the
      code look like a thing to be copied while keeping the brand green. Purely
      an enhancement – the accessibility defect is already fixed with
      `text/default` (9.12:1) and both invite surfaces now agree, so there is
      nothing wrong to repair. Only worth doing if Thomas wants to design it.
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

- [x] **DONE 2026-08-04 – `credentials/AuthKey_UN3YR958DC.p8` is copied into
      Apple Passwords**, which syncs via iCloud, so it now survives the Mac.
      Found when Thomas asked whether the setup could be rebuilt on a new Mac.
      App Store Connect issues that key **once** and it can never be downloaded
      again; it is gitignored because it signs releases, so until today it
      existed in exactly one place on earth. Losing the Mac would have meant
      revoking and regenerating it – discovered at the moment a fix needed
      shipping.
      Stored as a password entry rather than an attachment (Apple Passwords
      takes no files, and the key is 257 bytes of ASCII), with the Key ID and
      Issuer ID in the notes. **The BEGIN/END PRIVATE KEY lines are part of the
      key** – it is unusable without them.
      Recoverable anyway, and deliberately not duplicated: `ascApiKeyId` and
      `ascApiKeyIssuerId` live in `eas.json`, which is in the PUBLIC repo.
      Neither is usable without the `.p8`, so this is not an exposure – but if
      the key file is ever compromised, **revoke it in App Store Connect**
      rather than merely replacing it, because the other two pieces are public.
      Full "if the Mac were lost" audit in
      [backups-and-local-db.md](backups-and-local-db.md) – everything else is
      recoverable, including the design system (pushed to GitHub) and both env
      files (re-derivable from the Supabase dashboard). The other single-copy
      item is `~/Prepeat-backups/` itself.

- [ ] **Supabase Pro is MONITORED, not scheduled** (Thomas, 2026-08-04, after
      asking whether he had to upgrade or could watch – the honest answer
      changed once the local backup was proven to restore).
      **What Pro would actually add, given what now exists:** only two things –
      it runs when the Mac does not, and it lives somewhere other than the desk.
      On frequency it matches nightly-vs-daily, on retention it is WORSE (7 days
      against 30), and its backups have never been restored, where ours have.
      **Upgrade when any ONE of these becomes true:**
      1. **Real users who cannot be phoned** – ~30+ monthly actives, or the
         first support email from a stranger. Today's 18 are family and testers.
      2. **More than a few days away from the Mac.** Turn it on BEFORE
         travelling, not after.
      3. **Egress or database size past half the free limit** – 250 MB egress,
         250 MB database. At 162 MB / 31 MB today, so distant, but that is the
         point where the free tier stops being a choice.
      Keep the two free projects by putting anything else in a **separate Free
      organisation**; a Pro org bills every project in it.
      Not needed: PITR (~$100/mo add-on, rejected), and any capacity upgrade.
      **Decide the DEV ENVIRONMENT in the same sitting** – trigger 1 is the
      same moment for both, and doing them together is one upheaval instead of
      two. See "A second, free Supabase project as a DEV environment" under
      Ideas.

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
- [x] **Build 13 shipped to TestFlight, VALID (2026-08-03).** Carries the
      pre-build audit fixes: #1 (an imported recipe is no longer lost when its
      photo can't be fetched, and a failed save shows a real error), #5 (the
      Recipes tab, recipe detail and the shopping week switch all offer "Try
      again"; Shopping also gained the loading spinner it never had), and #6
      (the invite code is legible). #2 is NOT in this build – it is migration
      0025 and has been live for everyone since it was applied the same day.
      **The App Store review is untouched**: v1.0 is still bound to build 12
      and was deliberately left alone (Thomas, 2026-08-03, choosing to ship to
      testers without disturbing the queue). **So v1.0 will launch WITHOUT
      these four fixes** – plan a 1.0.1 with build 13 or later once v1.0 is
      approved and released.
      SUBMIT WENT CLEANLY THIS TIME – no hang, unlike build 12. But note the
      submit script's closing line printed "Build 12 is VALID" because Apple
      had not finished processing 13 yet: **that line names the latest build it
      can SEE, not the one you just shipped.** If the number is not yours, it
      has not landed. Polling for build 13 specifically found it VALID after
      3 minutes – much faster than build 12's ~25.
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

- **Before changing the plan → shopping reconciler, run
  `node scripts/check-shopping-reconciler.mjs`** and read every row (agreed
  2026-08-04, after getting that reconciler wrong three times in one afternoon).
  WHAT WENT WRONG, because the two causes need different answers:
  1. **A decision made silently.** The choice between showing the plan's TOTAL
     and showing what is still OWED was noticed while writing migration 0028 and
     settled in favour of the total *because it kept the bookkeeping simple*.
     Thomas got a list asking for 4 litres when he needed 1.
     THE RULE: when implementation surfaces a choice between two behaviours,
     that is a decision, not a detail. Say so and ask. Convenience of the
     invariant is never a reason to pick what the user sees.
  2. **States nobody enumerated.** "Clear done items" silently switched the
     whole mechanism off, and earlier the same day a plural fix worked in one
     direction only. Both times the verification covered the path being thought
     about, and the bug sat in a state that was never listed – even though
     "cleared" is a BUTTON in the UI.
     THE RULE: enumerate the states and walk the cross-product, rather than
     writing down the scenarios that come to mind. That is what the script does:
     every line state (ticked / cleared / unticked / hand-edited / deleted by
     the shopper) against every plan change, plus the multi-step sequences that
     single-state checks cannot reach.
  IT PAID FOR ITSELF IMMEDIATELY: the grid found three more bugs in 0030 before
  it was ever applied – a hand-edited outstanding line being overwritten, a
  shopper-deleted one coming back, and sync's own tombstones being counted as
  "already bought" so that un-doubling then re-doubling showed nothing.
  ITS LIMIT, which matters: the script mirrors the SQL, it does not run it. It
  proves the rules are coherent, not that the functions implement them – and on
  both occasions the model was wrong, a mirror written from the same model would
  have agreed with the bug. A local Postgres harness would close that gap and
  does not exist; it is worth building if the mirror ever drifts, but it is not
  what failed today. **A device walk-through remains the only thing that settles
  a change.**
  **UPDATE 2026-08-04: the harness now exists** – local Supabase in Docker (see
  the next item and the 2026-08-04 decision). The mirror script keeps its value
  for enumerating the state cross-product cheaply, but "the model was wrong so
  the mirror agreed with the bug" is now testable against real SQL.

- **Run every migration against local Supabase before it touches production**
  (agreed 2026-08-04, off the back of the Free-plan-has-no-backups finding).
  Production is one project serving every installed build at once, so an applied
  migration has no blast radius limit. Two commands, in this order:
  1. `npm run db:reset` – replays EVERY migration onto an empty database. This
     is the one that catches what 0022 was: a migration that does not apply
     cleanly from scratch. It is not a substitute for reading the SQL, it is the
     check that the file even runs.
  2. `npm run db:start` and point a dev build at it, for anything that changes
     behaviour the shipped app relies on.
  Still standing, and NOT replaced by any of this: **never drop or rename a
  column in the same round as the code change that stops using it** (2026-07-27)
  – local Postgres cannot see what is on somebody's phone.

- **Keep [release-notes.md](release-notes.md) current, INCLUDING the version
  number** (started 2026-08-03; Thomas wants something ready to post whenever
  the app updates, and has explicitly handed the number over: "I will
  forget"). Three standing jobs, in order of how easily they rot:
  1. **Add the user-facing line when a change lands**, not when a build
     ships – by build time the reasoning is cold and the wording is guesswork.
  2. **Re-check the NEXT VERSION line in the same edit.** Semver decides it,
     so this is bookkeeping: a feature raises a pending 1.0.1 to 1.1.0, and
     the number never drops again within one release.
  3. **Keep the three buckets honest** – accumulating (dev build only), per
     TestFlight build, and server changes, which reach every phone whatever
     version it runs and so belong to no version at all.
  At submission time, and only then: bump `app.json` `expo.version` to the
  number that line has been carrying, and move the section under its own
  heading with the date.

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

- **2026-08-04 – what protects the database once strangers have data in it.**
  *(The runbook – commands, file locations, what is installed on the Mac, and
  the real restore procedure – is
  [backups-and-local-db.md](backups-and-local-db.md). The entries below are the
  reasoning behind it.)*
  Thomas's realisation, unprompted: a migration is live for everybody the
  moment it runs, while app code waits for a build – so a bad one has no blast
  radius limit. Right, and the right week to act on it, with v1 sitting in
  review.
  **The asymmetry is narrower than it first looks, and that shapes the answer.**
  Migration 0022 broke the Plan tab on every phone in an hour; 0023 fixed every
  phone in five minutes, with no build and no Apple. A server change that
  BREAKS something is the cheapest bug we have. What cannot be fixed forward is
  DESTROYED DATA – a bad `UPDATE`/`DELETE`, or a `DROP` that takes the contents
  with it. So the defence is aimed at irreversibility, not at instantness.
  **Facts that decided it** (checked against Supabase's own pricing and backup
  docs on the day, because I had two of them wrong from memory):
  - **Free takes NO automatic backups at all.** Not few – none. Supabase's own
    advice to free users is to export the data yourself.
  - **Pro ($25/mo) is daily backups, 7-day retention.** Worst case: lose up to
    24 hours.
  - **PITR is NOT in Pro.** It is a ~$100/mo add-on. Rejected: paying that to
    turn "lose a day" into "lose a minute" is not a trade a meal-planning app
    needs to make.
  - **Usage is nowhere near any free limit** – 31 MB of 500 MB database, 18 of
    50,000 MAU, 162 MB of 5 GB egress. So growth is not a reason to upgrade and
    will not be for a long time; **the only thing $25 buys is the safety net**,
    which makes it a clean decision rather than a bundled one.
  **THE CALL (Thomas, all three):**
  1. **Pro at public launch, not before.** Today's 18 users are family and
     testers – people he can ring. That changes the moment a stranger has three
     months of recipes in there. In the pre-launch checklist, bound to the
     Release button rather than to a date.
  2. **A nightly export in the meantime** (`scripts/backup-supabase.sh`, launchd
     at 03:15). Free, and the copy is ours rather than Supabase's. Its honest
     weakness: it only runs when the Mac is on – which is exactly why it is a
     stopgap and not the answer.
  3. **Local Supabase in Docker as the migration test bed**, over a second
     cloud project. Both are free (2 free projects, and they survive a Pro
     upgrade if kept in a separate Free organisation) – but a free cloud project
     pauses after a week idle, which is friction on the day you are in a hurry,
     and local rebuilds the whole database from 0001 in seconds. **That last
     part is the real argument**: replaying every migration onto an empty
     database catches "this does not apply cleanly", which is the exact class
     0022 belonged to. It also builds the harness the reconciler note under
     Recurring says is missing – the mirror script proves the rules are
     coherent, a real Postgres proves the SQL does what the rules say.
  Three things found while wiring it up, all worth keeping:
  - **⚠️ A launchd job cannot read anything in `~/Documents`.** The first
    scheduled run failed with `Operation not permitted` (exit 126) – macOS
    privacy protection covers Desktop/Documents/Downloads, and a background job
    has none of the permissions a Terminal inherits. **The script run by hand
    worked perfectly**, which is exactly what makes this dangerous: it would
    have looked installed and produced nothing, and nobody finds that out until
    the day they need a backup. Fixed by installing a runtime copy into
    `~/Library/Application Support/Prepeat` (`npm run backup:install`), which
    also means **editing `scripts/backup-supabase.sh` does nothing until that
    command is re-run**. The general lesson: **a scheduled job is not installed
    until it has been observed succeeding ON THE SCHEDULER** – `launchctl
    kickstart` then read the exit code. Running the script yourself proves
    nothing about the job.
  - **`pg_dump` does not back up the recipe photos.** They are files in Supabase
    Storage, not rows in Postgres – 267 of them, 54 MB. The `recipe-photos`
    bucket is public-read, so the mirror needs no credentials at all: object
    names come from `storage.objects`, each file is fetched by URL with curl.
    That removed the last dependency on the Supabase CLI, node, and the repo –
    which the TCC problem above made necessary anyway. It is a MIRROR, not a
    snapshot: unchanged files are skipped (a second run takes 9s, not 2.5min)
    and a photo deleted upstream is KEPT, deletion being the case a backup is
    for.
  - **The archives hold real user data** (email addresses, recipes), so they
    live in `~/Prepeat-backups`, outside the repo – which is PUBLIC – and
    outside iCloud. Checked on the day: `~/Documents` is a real folder, not an
    iCloud symlink, and FileVault is on.
  **Verified 2026-08-04**, not just written: a launchd run exited 0, and the
  archive holds 115 recipes, 1,624 recipe ingredients, 204 plan entries, 1,857
  shopping-list items, 8 accounts, plus 15 tables / 25 functions / 19 RLS
  policies of schema.

- **2026-08-04 – the restore rehearsal found FOUR ways the backup would not
  have restored, and the file looked perfect throughout.** This is the entry to
  re-read if the value of `npm run backup:verify` is ever questioned. Every
  failure was invisible from the archive: right size, right row counts, written
  nightly, and it would have failed on the day it was needed.
  1. **`CREATE SCHEMA "public"` collides with every fresh database.** The dump
     opens with it; any new Postgres – including a brand-new Supabase project –
     already has one. Died on line 26. Fixed in the RESTORE (`drop schema
     public cascade` first) rather than by adding `--clean` to pg_dump: that
     would put DROP statements at the top of a file written nightly and kept
     for 30 days. The destructive step belongs where it is a conscious act.
  2. **The target has to be Supabase-shaped, not an empty database.** The dump
     refers to `auth` – RLS policies call `auth.uid()`, and public tables carry
     foreign keys into `auth.users`. Restoring into a plain scratch database
     died on line 9236. **And therefore ORDER MATTERS**: accounts first, app
     data second, or the foreign keys have nothing to point at. That ordering
     was not written down anywhere before this.
  3. **`auth.schema_migrations` / `storage.migrations` cannot be restored** –
     "permission denied". They are GoTrue's and Storage's own ledgers, owned by
     those services and recreated by them.
  4. **`storage.buckets_vectors` – the same thing again**, which is the real
     lesson: excluding service tables one by one is a denylist, and it would
     have broken silently the next time Supabase added an internal table. The
     dump now takes an **allowlist of exactly four tables** (`auth.users`,
     `auth.identities`, `storage.buckets`, `storage.objects`). Deliberately not
     kept: sessions, refresh tokens, MFA claims, one-time tokens, audit logs.
     People sign in again after a restore – which they must anyway, since a
     rebuilt project has a new JWT secret that old tokens cannot match.
  **THE RESTORE PROCEDURE, now that it is known** (`scripts/verify-backup-restore.sh`
  runs exactly this against local, so it stays true):
  `drop schema public cascade` → `truncate storage.objects, storage.buckets
  cascade` → `delete from auth.users cascade` → restore `auth-storage-data.sql`
  → restore `public.sql`.
  **PASSES as of 2026-08-04**: 7,246 rows across 15 tables restored exactly,
  8 accounts, 267 storage rows, 15 tables / 25 functions / 19 policies.
  **All 30 migrations also replay cleanly onto an empty database** – the 0022
  class of failure, tested for the first time and passing.
  THE GENERAL RULE: **an untested backup is a hypothesis.** Re-run
  `npm run backup:verify` after any change to the schema, the dump, or the
  Supabase plan.

- **2026-08-04 (later the same day) – cut it back, after Thomas said it had
  become "too patched together".** His words: *"I need my mac awake in the
  middle of the night. The back up is on my mac locally, seems unsafe. It feels
  like a lot of ifs and uncertainty."* All three correct, and the drift is worth
  naming: he asked whether he could monitor instead of paying $25/mo, I said
  yes, and then built a scheduled job, a workaround for macOS blocking it, an
  installer so the copy could not drift, an alarm to watch the job, and a
  rehearsal to prove the alarm's subject worked. **Each step was a sound answer
  to the previous step's weakness; the sum was machinery with more failure modes
  than the thing it replaced.** He declined Pro, so the fix had to be removal,
  not purchase.
  **What changed:**
  1. **No fixed hour.** At login, then every 6h while the Mac is on, and it does
     nothing unless the newest backup is over 12h old. A laptop is not a server.
     A week with the lid shut now self-heals at the next login instead of
     producing a week of misses.
  2. **One job, not two.** The freshness alarm was a second script and a second
     job watching the first; it is now a branch inside the backup script.
     `check-backup-freshness.sh` deleted. **Accepted cost:** if the job itself is
     removed, nothing notices. Fewer parts was worth more than that watchdog.
  3. **A failure only warns if it matters** – judged against the age of the last
     GOOD backup, so a flaky moment on the wifi retries at the next tick instead
     of raising a dialog.
  **iCloud Drive was tried for the off-site copy, and REJECTED.** A launchd job
  gets partial, unreliable access: it wrote the database archive, was refused on
  all 267 photos ("Operation not permitted"), and could not read the folder it
  had just written, so it re-fetched everything every run. Before that it
  refused to start at all (EX_CONFIG, exit 78) because launchd cannot even open
  a LOG file inside iCloud – so the log now lives in `~/Library/Logs`.
  **THIS IS THE SECOND TIME THE SAME LESSON ARRIVED** (the first was
  `~/Documents`): the manual run worked perfectly both times. **A scheduled job
  is not installed until it has been watched succeeding ON THE SCHEDULER.**
  So there is still no copy off the Mac. The honest options are Time Machine
  (no destination configured today) or Pro – written up in
  [backups-and-local-db.md](backups-and-local-db.md), not papered over.

- **2026-08-04 – a staleness alarm, because the danger is not the missing
  backup but the believed-in one.** *(SUPERSEDED the same day – merged into the
  backup script, see the entry above. Kept for the reasoning, which still
  holds.)* Thomas's call, in the same breath as
  deciding to monitor Pro rather than buy it: the risk that actually kills you
  is trusting a backup that quietly stopped in March, and that risk is
  identical whether or not Supabase is being paid. So it got built first.
  `scripts/check-backup-freshness.sh` warns with a dialog when the newest
  archive is more than 3 days old, when there is no archive at all, or when the
  last run logged FAILED.
  **`RunAtLoad` is the whole point** – it fires at login, so a fortnight away
  with the Mac shut is caught the moment Thomas comes back. A 10:00 daily run
  covers a Mac that just stays logged in. Three days of tolerance means a
  weekend away does not nag.
  Two things deliberately built in: the dialog carries a **"Back up now"**
  button that runs the backup, so noticing and fixing are one action; and it
  has `giving up after 300`, because a dialog nobody dismisses would otherwise
  keep a launchd job alive forever. The script also runs WITHOUT `set -e` – an
  alarm that dies silently on an unexpected error is worse than no alarm.
  Both paths tested on 2026-08-04: fresh backups log OK and exit 0 silently;
  forcing the threshold negative produced the dialog and the STALE log line.

- **2026-08-03 – Semantic Versioning, with the digits defined in app terms.**
  Thomas, after going back and forth on whether the next release was 1.0.1 or
  1.1: the value of the rule is that it decides instead of him. Semver was
  written for libraries, where MAJOR means "I broke your callers" – an app has
  none, so the digits are spelled out in
  [release-notes.md](release-notes.md): PATCH = fixes and polish only, MINOR =
  a new capability worth a sentence in the App Store notes, MAJOR = a release
  existing users have to re-learn. By that rule the next release is 1.1.0,
  because the leftover move is a feature.
  Two things it deliberately does NOT number: the EAS build counter (12, 13, …
  auto-increments, and many builds sit under one version – build 12 and 13 are
  both 1.0.0), and migrations, which are live for every version at once the
  moment they run.
  `app.json` `expo.version` is bumped when preparing a submission, not when
  work lands – v1.0.0 is in review and stays untouched.

- **2026-08-03 – moving a past week's leftovers onto this week.** Thomas's
  idea in the morning, designed and built the same day (Figma 434:7148).
  Product shape, all his calls:
  - **Unchecked items only.** A ticked item was bought; it belongs to the
    week it was bought in.
  - **Manual, never automatic.** Rolling leftovers forward by themselves is
    invisible and slightly spooky – things appear that nobody added, and by
    the time you notice, the undo window is long gone.
  - **Push, from the old week** – the button is drawn at the end of a PAST
    week's list and always targets the current week, so two weeks back still
    pushes forward to today rather than one week along. (First recorded
    backwards, as a pull from this week; corrected the same day.)
  - **No confirmation dialog.** The items vanish on tap and the existing undo
    toast offers them back. Cheap-and-reversible beat guarded-and-annoying.
  - **No button where there is nothing to move** – a fully-bought past week,
    or the current week itself, which has nowhere to push to.
  How it is built, and why it is not a `list_id` update. A plan-fed line
  carries `shopping_list_item_contributions` rows tied to the OLD week's meal
  entries, and those entries stay put – repointing the row would drag that
  bookkeeping onto a week the meal was never on, where `withdraw_entry` would
  later subtract from the wrong list. So a moved item arrives as a fresh,
  user-owned row (`added_manually`, no contributions) and the old row is
  soft-deleted: it stops being the plan's item and becomes yours, which is
  what it means in real life anyway. It merges through `item_merge_key`, so
  two leftover onions onto a week that already plans three give one line of
  five – not the double row the 2026-07-29 merge work removed.
  Two departures from `contribute_entry_into` worth knowing about, both
  deliberate. It merges only into an UNCHECKED line, because folding a
  leftover into something already ticked off this week would make it arrive
  pre-bought and invisible. And it DOES fold into a hand-edited line, which
  the plan reconciler refuses to do: those rails exist so automatic
  reconciliation never overwrites a number the family set by hand, and this
  is not automatic – somebody just asked for it, and folding adds to their
  number rather than replacing it.
  Undo reverses both halves from a server receipt rather than just clearing
  `deleted_at`, because the items also landed somewhere else and may have
  merged on arrival. Created lines are deleted; merged lines give back
  exactly what was added and no more – the same lesson as 0025's
  `applied_quantity`. It lives for the toast's five seconds and no longer, in
  memory, exactly like every other undo on this screen.

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
