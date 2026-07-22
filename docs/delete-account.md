# Delete account & wipe my data (GDPR erasure) – spec

Status: **BUILT 2026-07-22 (commit 25df0ac), verified on device.** Migration
0016 makes the attribution columns nullable + ON DELETE SET NULL and adds
`delete_profile()`, which deletes sole-member households, clears check-off
initials, then deletes the auth user. A direct `delete from auth.users` from a
SECURITY DEFINER RPC works in Supabase, so **no Edge Function was needed**
(the implementation note below anticipated one – it turned out unnecessary).
UI: red-outline "Delete profile" in the Edit-profile sheet + a confirm sheet
with a "type DELETE" fail-safe. Follow-up: recipe photos of deleted
sole-member households stay orphaned in storage (no personal data). Original
decisions below (decided 2026-07-21). PRE-LAUNCH gate now met.

Two forces make this required, and one is a hard gate:

- **GDPR** gives EU users the right to erasure.
- **Apple App Store rule**: any app that lets you *create* an account must let
  you *delete* it in-app. App Review rejects apps without it.

So unlike [leave-household.md](leave-household.md) (v1.1+), this ships **before**
the public App Store release. Filed under the Pre-launch checklist.

**Terminology (design 2026-07-22):** the UI calls this **"Delete profile"** and
reaches it from **"Edit your profile"**. Throughout this spec "account" means
the same thing – the user-facing word is "profile".

## Goal

Let a user erase themselves and every trace that points to them – without
destroying the shared content the rest of the household still relies on.
Recipes and plans are owned by the *household*, not the person, so "wipe my
data" is **erase-me + anonymise-my-traces + delete-anything-only-mine**, not
"delete everything I ever touched".

## The three erasure moves

1. **Erase you** – login (auth), profile (name, email), household memberships.
2. **Scrub your traces from shared things that stay with the family** – your
   "added by" name on recipes you contributed, and the "checked off by" marks
   on the shopping list, are cleared so nothing points back to you.
3. **Wipe anything that was only yours** – any solo/parked kitchen where you
   are the last member is deleted entirely (its recipes, plans, lists, and
   recipe photos).

## What gets erased vs. what stays

| Data | On account deletion |
|---|---|
| Your login (email + sign-in) | **Deleted** |
| Your profile (name, email) | **Deleted** |
| Your household memberships | **Deleted** |
| Recipes you added to a **shared** family | **Kept by the family, your name cleared** |
| Your "checked off by" marks on the shopping list | **Cleared** |
| A solo/parked kitchen where you're the **only** member (recipes, plans, lists, photos) | **Deleted entirely** |
| The family's shared meal plan / shopping list | **Kept** |

## The flow the user sees

1. In **Household**, taps **Delete my account** (low-key – a rare, irreversible
   action, kept away from everyday controls).
2. A confirmation screen spells out what will be deleted, and **adapts**:
   - Sharing a household → "your family keeps the recipes, your name is removed".
   - The **only** member of a kitchen → "its recipes will be permanently deleted".
3. Because it's irreversible, it asks for a deliberate confirmation (type
   "DELETE" or re-enter a fresh email code) – not a single tap.
4. On confirm, a secure server step erases everything and signs you out. The
   same email can sign up fresh later as a brand-new user, no trace of the old.

## Locked decisions (Thomas, 2026-07-21)

1. **Where:** in the **Household** area. Designed 2026-07-22 inside the **Edit
   your profile** sheet (reached from the pencil on your own member row) – not
   on the main screen. No separate Settings/Account area yet.
2. **Timing:** **instant** hard delete on confirm – no grace period, no undo,
   no scheduled cleanup job. The strong confirmation in step 3 is the guard.
3. **Recipes you added to a shared family:** the **family keeps them, your name
   is cleared** (consistent with household ownership – they're the family's
   cookbook now).
4. **What replaces your name:** **nothing** – attribution is simply cleared
   (the recipe no longer says "added by anyone"; check-off marks blank out).

## Edge cases & rules

- **Sole-member wipe is a rule, not a choice.** A kitchen with only you is
  yours alone, so it and all its content go with you. The confirmation just
  makes that unmistakable (see the adaptive copy above).
- **It's a true hard delete.** GDPR erasure means the data is actually gone –
  not the app's usual soft-delete (`deleted_at`) where a hidden copy remains.
- **Re-signup is clean.** After deletion the same email can register again as a
  brand-new user with an empty personal household – no revival of old data.
- **Distinct from Leave household.** Leaving *keeps* your data (you copy
  recipes into your own kitchen); deleting *erases* you. Both may share the
  Household area.

## Relationship to the leave spec's open question

[leave-household.md](leave-household.md) left open: "once a member leaves, should
their name stay on the recipes they added for the remaining family?" This spec
answers it **for the erasure case only** – on account deletion the name must be
cleared. Plain leaving (the member keeps their account) is still a separate
call and remains open.

## Implementation notes (for build time, not product decisions)

- **Needs a secure server step.** Deleting the auth user requires service-role
  / admin access – it cannot be done from the client (anon key). Implement as a
  Supabase **Edge Function** (or SECURITY DEFINER RPC) that re-verifies the
  caller, then: anonymises traces, deletes sole-member households, and calls
  `auth.admin.deleteUser()`. All-or-nothing.
- **Schema change – attribution columns must become nullable.** Today these are
  `not null references auth.users(id)` with **no `on delete`**, so a plain auth
  delete is *blocked* (RESTRICT) while the person's id is still stamped
  anywhere. Decision #4 ("clear the name") means we null them, so make nullable
  and set null on erasure:
  - `recipes.created_by_user_id`
  - `meal_plans.created_by_user_id`
  - `shopping_lists.created_by_user_id`
  - `shopping_list_items.created_by_user_id` and `checked_by_user_id`
    (+ `checked_by_initial` text → clear)
  - `households.created_by_user_id` (creator of a *shared* household being
    deleted)
  - `invites.created_by` and `invites.used_by_user_id`
- **Already cascade cleanly** (no work): `profiles`, `household_members`,
  `invite_redemptions` (0012) – all `on delete cascade` from `auth.users`.
- **Sole-member households**: delete the household row and its recipes / meal
  plans / shopping lists / shopping-list items, and remove its recipe photos
  from the storage bucket (0006).
- **Retention**: a meal-planning app holds nothing legally required to retain,
  so full erasure is clean – no carve-outs needed.
- This is the manual operation we hit when cleaning up test users
  (e.g. sebell@mac.com, 2026-07-21) – the same FK blocks are why a dashboard
  delete fails until the traces are cleared.
