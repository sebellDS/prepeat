# Leave household – spec

Status: **BUILT 2026-07-22 (commit f4277cd), verified on device.** Migration
0015 `leave_household()` does the atomic copy-on-leave; the client copies recipe
photos into the new kitchen's folder. Entry point: a red-outline "Leave
household" in the Edit-**profile** sheet (only when the household has other
members). Built on the app's current tokens pending the DS retune. Original
decisions below (decided 2026-07-20).

Implements the copy-on-leave promise from
[projektgrundlag.md](projektgrundlag.md) decision #1, and touches the
multi-household model (decision #3). Both are already filed under
"Later (v1.1+)" in the foundation. This doc records the product decisions so
design and build can follow without re-litigating them.

## Goal

Let someone step out of a shared family household and walk away with their
own copy of the recipes, while the family they left keeps everything intact.
The "take your cookbook with you when you move out" promise.

## When "Leave" appears

Leaving only makes sense in a household with **other people**. A solo
household (a "household of one") has nobody to leave, so the button is hidden
there. This also means a shared household is never left empty and abandoned:
the last person standing is a solo household, with nothing to leave.

## Happy path (what the user sees)

1. In **Household**, taps **Leave household** (low-key, not a big primary
   button – a rare, deliberate action).
2. A confirmation screen explains what happens (copy below) and asks to
   confirm.
3. On confirm, in one atomic server step: a fresh personal household is
   created, the family's recipes are copied into it, and the person's
   membership in the family household is removed.
4. They land in their new personal kitchen – like a brand-new solo user, but
   with the copied cookbook already in it.

## What moves vs. what stays

| | Leaver takes a copy? | Stays with the family? |
|---|---|---|
| Recipes (the cookbook) | Yes – full snapshot | Yes – unchanged |
| Meal plan (this/next week) | No | Yes |
| Shopping list | No | Yes |
| Invite code / membership | No | Yes |

Recipes are a lasting library worth keeping; the meal plan and shopping list
are shared, in-the-moment coordination that belongs to the family. The leaver
starts with an empty plan and list in the new kitchen.

## Locked decisions (Thomas, 2026-07-20)

1. **Where:** the Leave button lives in **Household**.
2. **What moves:** the leaver copies **recipes only** (not the meal plan or
   shopping list).
3. **New kitchen name:** auto-named **"[Firstname]'s Kitchen"** (e.g.
   "Thomas's Kitchen"); renameable later.
4. **Attribution in the copy:** every copied recipe is re-attributed to the
   **leaver** (`created_by_user_id` set to the leaver). Chosen for **GDPR** –
   the leaver's private copy then carries none of the other members' personal
   data ("added by Anna" is dropped). The family household keeps its own
   recipes with their existing attribution.

## Rejoining after leaving (rule A, decided 2026-07-20)

Scenario: Anna leaves, gets "Anna's Kitchen" with a copy, tinkers with it,
then the family invites her back.

**Rejoining is plain joining – it does not merge, sync, or delete anything.**
Anna becomes a family member again and sees the family cookbook as it stands
now. "Anna's Kitchen" keeps existing, untouched. The two cookbooks drifted
apart the moment she left and never reconcile automatically:

- She **edited** a recipe in her copy → the family's version is unaffected;
  her edit stays in her kitchen. Two independent versions.
- She **added** a new recipe in her copy → it lives only in Anna's Kitchen;
  rejoining does not carry it into the family cookbook.
- She **deleted** a recipe from her copy → only her copy lost it; the family's
  cookbook still has it, so on rejoin she sees it again.

Nothing she did in her private copy can change the family's cookbook, and
rejoining can never lose her private work.

**The catch – and why this needs the switcher.** After rejoining, Anna is a
member of two households at once. v1's UI only shows one, and today
`fetchMyHousehold` shows the **oldest** membership – which would keep showing
"Anna's Kitchen" and make the rejoin look ignored. Rule A's resolution:

- Rejoin = plain join, **no auto-merge, no dedup** (auto-merging would
  duplicate every original recipe the family still has).
- The **just-joined household becomes the active one** (change the
  "which household shows" rule away from oldest-membership-wins).
- "Anna's Kitchen" and its extras are **preserved, not deleted**, but
  **parked** – out of reach until household-switching / merge ships. At the
  rejoin moment, say so plainly: *"Recipes you added in your own kitchen are
  saved, and you'll be able to bring them over once household switching
  arrives."*

Bringing the parked recipes into the family later is the deferred
"merge / copy a recipe to my other household" feature (projektgrundlag,
Later v1.1+) – deliberately out of scope here.

## Leaving again (uniform rule, decided 2026-07-21)

If Anna rejoins and then leaves a second time, she is **never left with
nothing** – the "always ≥1 household" invariant and the copy-on-leave promise
guarantee she lands somewhere with her recipes. One uniform rule covers every
leave:

> **Every leave behaves identically: snapshot the recipes you currently have
> access to, drop them into a personal kitchen, and remove you from the
> household you left.**

So leave #2 makes a **fresh copy of the family's current recipes** into a
**new** personal kitchen ("Anna's Kitchen 2", named more gracefully). It does
**not** drop her back into her stale stint-#1 kitchen, for two reasons:

- On leave #2 she expects the recipes she was **just using** with the family,
  including anything added while she was back – her old kitchen has drifted
  and may be missing them. A fresh snapshot gives exactly what she expects.
- Re-copying into the old kitchen would **duplicate** everything already in it
  – the merge/dedup problem this feature deliberately defers.

The copy is re-attributed to the leaver, same as decision #4.

**Accepted cost:** the stint-#1 kitchen becomes stale cruft – a household she
is still in but no longer needs. Harmless for now (invisible until the
switcher ships) and cleaned up properly by the planned switcher + merge
(delete or merge stale kitchens then).

**Rejected alternative:** reuse the old kitchen and skip the re-copy. Tidier
(no pile-up) but gives a surprising "where did the family's recipes go?"
moment and needs extra bookkeeping to track which kitchen is "hers".

## Dependency: "Change household" (the switcher)

Rule A leans on being able to change/switch the active household – a feature
never built (v1 shows one household by design). Leave/rejoin makes a
two-household state reachable for the first time, so the switcher graduates
from "someday" to a real dependency of this feature. Tracked as its own
backlog item.

**Designed 2026-07-22.** The switcher is a dropdown from the "Household ▾"
title: it lists the households you belong to (checkmark on the active one)
plus a "Join a household" action; selecting one switches the active
household. Joining reuses the onboarding invite-code screen and lands on the
welcome screen. Build must change `fetchMyHousehold`'s "oldest membership
wins" rule so the selected / just-joined household becomes active. The Leave
action lives inside the **Edit household** sheet; its confirmation copy in
Figma now carries the copy-on-leave promise.

**Naming:** the design shows the personal household by its auto-name in the
switcher (earlier "My own kitchen" was a placeholder). The mock reads
"Thomas3' kitchen" – build must generate it as **"[Firstname]'s Kitchen"**
(capital K, proper 's, e.g. "Thomas's Kitchen") per decision #3.

## Confirmation copy (draft – refine at design time)

> **Leave [Household name]?**
> You'll get your own copy of the recipes to keep. Your meal plan and
> shopping list stay with the family, and you'll need a new invite to rejoin.

## Implementation notes (for build time, not product decisions)

- **One atomic server action** (SECURITY DEFINER RPC): create the personal
  household + membership, copy recipes (re-attributed to the leaver, per
  decision #4), delete the family membership. All-or-nothing so a failure
  never strands the user household-less (breaks the "always ≥1 household"
  invariant).
- Migration `0011` already ensures a departed member (incl. a creator) loses
  access and cannot silently rejoin without a fresh invite – the guard rail
  this flow relies on. No new access needs granting on leave.
- `fetchMyHousehold`'s "oldest membership wins" rule
  ([household.ts](../src/lib/household.ts)) must change so the just-joined
  household becomes active (rule A). Revisit alongside the switcher.
- Copy mechanic mirrors the `copied_from` column already scaffolded in
  migration `0006`.
- **Every leave creates a new personal household** (uniform rule above), so
  the auto-name from decision #3 must disambiguate on repeat leaves – e.g.
  "Anna's Kitchen", then "Anna's Kitchen 2" – rather than collide.

## Open sub-question (not yet decided)

- **The family's own copy after a member leaves.** Decision #4 covers the
  *leaver's* copy. Separately: once Anna leaves, should her name stay on the
  recipes she added for the remaining family, or be anonymized there too for
  GDPR? Not ruled on – flag at design/legal review.
