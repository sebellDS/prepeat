# Prep+Eat – Project Foundation

A single document capturing the decisions, stack and data model for a family
meal-planning app. The basis for further work in a dedicated project.

> Formerly working-titled "Madapp". The app is now **Prep+Eat** (plain-text
> form "Prepeat"). UI language is English; audience is international.

## Purpose

A mobile app for family meal planning. Core functionality:

- **Recipes**: added manually or imported from a URL
- **Weekly plan**: planning meals one week at a time
- **Shopping list**: generated automatically from the weekly plan, also
  editable manually
- **Family sharing**: several family members share recipes, the weekly plan
  and the shopping list
- **Real-time sync**: ticking off an item on one phone updates everyone
  else's instantly

The goal is release on the App Store (iOS), possibly Android later.

## Technology choices

**Platform: React Native via Expo**

None of the app's features require native iOS. Real-time sync, URL parsing and
shared data are all areas where the React Native ecosystem is strong or
stronger than native. Expo removes most of the hassle around iOS signing and
App Store release via EAS Build. Android can be added later without rebuilding
everything.

### Stack

- **Expo** (the React Native framework)
- **TypeScript** – better AI-generated code, early error catching
- **Supabase** – Postgres, realtime, auth and row-level security in one package
- **NativeWind** (Tailwind for React Native) – translates cleanly if the Figma
  design uses Tailwind tokens
- **Supabase Edge Functions** – for backend URL parsing

### Workflow

- Design in Figma with Auto Layout, named components and variables for
  colors/typography
- Claude Code reads Figma frames via the Figma MCP integration and builds the
  screens
- Git-versioned code, committed after review

## Core decisions (data model)

> The household and recipe-ownership decisions below were revised on
> 2026-06-12 after working through the full household lifecycle (create,
> invite/join, multi-household, leave, merge). The reasoning is preserved so
> the "why" survives.

### 1. Recipes are owned by the household (with copy-on-leave)

Within a family the cookbook is shared. Every recipe a household has is
automatically visible to all its members – no "share" button, no "mine vs
shared" distinction. This matches how a family actually thinks about its
cookbook, and keeps both the data model and the UI simple (no `recipe_shares`
table, no per-recipe sharing step).

The classic counter-argument – "take your recipes with you when you move out"
– is solved by **copy-on-leave**: when a member leaves a household, that
household's recipes are copied into a personal household for the person
leaving. From that moment the two cookbooks drift apart (the snapshot
principle, same as decision #5) – edits made after the split do not cross
over. Everyday life is therefore as simple as possible, and only the rare
leaving event costs a little extra work.

Attribution is preserved via `created_by_user_id` on the recipe ("added by
Anna") without making ownership personal.

This resolves the old open question "fork vs share": because recipes are
household-owned and copies are made at lifecycle moments, a per-recipe fork
feature is not needed for v1.

### 2. Every user always belongs to at least one household

There is no such thing as a household-less user. At sign-up a household is
created automatically (a "household of one") unless the user joins an existing
one via an invite. A solo household is not a special type – just a household
with one member; it grows when someone is invited. This invariant removes a
whole category of edge cases: no "you have no family yet" empty state, and the
user's data always has a home to live in.

### 3. Multiple households per user (model supports it, switcher deferred)

The data model supports a user being a member of several households at the
same time (separated parents, helping aging parents, shared housing plus
family). It costs next to nothing in `household_members` (a join table). In v1
the UI shows only one household, to avoid a "which family am I looking at now?"
switcher on every screen. Because recipes are household-owned, each household
has its own cookbook – which for the two-homes case is actually the correct
behavior. Moving a recipe between your own households is a simple "copy to my
other kitchen" action (the same copy mechanic as copy-on-leave).

**Merging households** is a related future operation: two households are
combined into one by adding one's members to the other and copying one's
recipes across; one household's active weekly plan / shopping list is kept and
the other's archived (two weekly plans cannot be meaningfully fused).
Implemented by letting one household "survive" rather than minting a third.
Deferred to v1.1+.

### 4. Weekly plan and shopping list are owned by the household

That is the whole point of sharing.

### 5. Ingredients are "snapshotted" at planning time

When a recipe is added to the weekly plan, its ingredients are copied into
`meal_plan_entry_ingredients`. The shopping list reads from the snapshots, not
from the recipe itself. This means changing or deleting a recipe does not break
the weekly plan or shopping list – the same principle as an invoice line that
must not change retroactively.

### 6. No roles in v1

All household members are equal. There is no owner/member distinction. A role
column can be added later if the need arises.

## Data model

### Users and households

- `users` – handled mainly by Supabase Auth
- `households` – id, name, created_at, updated_at
- `household_members` – user_id, household_id, joined_at (join table; multiple
  rows per user supports multi-household)
- `household_invites` – id, household_id, code (unique), created_by,
  expires_at, used_at, used_by_user_id

### Recipes

- `recipes` – id, household_id, created_by_user_id, title, description,
  source_url, servings, prep_time, cook_time, image_url, forked_from_recipe_id
  (nullable – set when the recipe is a copy), created_at, updated_at, deleted_at
- `recipe_ingredients` – id, recipe_id, name, quantity, unit, note, sort_order,
  aisle/category (optional)
- `recipe_steps` – id, recipe_id, step_number, text
- `recipe_shares` – **removed.** Recipes are household-owned, so everything in
  a household is shared by definition. The "share with another household"
  concept is replaced by copying recipes between households at lifecycle
  moments (leave, merge, copy-to-my-other-kitchen).

### Meal planning

- `meal_plans` – id, household_id, week_start_date (Monday), created_at,
  updated_at, deleted_at
- `meal_plan_entries` – id, meal_plan_id, date, meal_type
  (breakfast/lunch/dinner/snack), recipe_id, servings_override
- `meal_plan_entry_ingredients` – id, entry_id, name, quantity, unit, note
  (snapshot from the recipe at planning time)

### Shopping list

- `shopping_lists` – id, household_id, name, week_start_date (optional),
  created_at, updated_at, deleted_at
- `shopping_list_items` – id, list_id, name, quantity, unit, aisle, is_checked,
  checked_by_user_id, checked_at, added_manually (bool), source_entry_id
  (nullable, points to a meal_plan_entry if auto-generated), updated_at

### Cross-cutting fields

- `created_at`, `updated_at`, `created_by_user_id` on all main tables
- `deleted_at` (soft delete) on recipes, shopping_lists, meal_plans
- `updated_at` is critical for "last write wins" concurrency

## Scope in v1

### In v1 (MVP)

- Household-owned recipes (manual creation + URL import with schema.org
  fallback)
- Auto-created household at sign-up; every user always has at least one
  household
- One household per user in the UI (multi-household in the data model)
- Weekly plan, one week at a time
- Shopping list generated from the weekly plan + manual additions
- Real-time sync of the shopping list and weekly plan
- Invite flow via link/code
- Simple ingredient merging (match on trimmed, lowercased name + unit)
- Snapshot of ingredients at planning time
- Optimistic updates and loading states in the shopping list
- Soft deletes
- "Last write wins" concurrency

### Later (v1.1+)

- Multi-household UI (the household switcher)
- Copy-on-leave, and "copy a recipe to my other household"
- Merging two households into one
- Advanced ingredient normalization ("onion" vs "yellow onion", g ↔ kg)
- Backend URL-parsing robustness
- Better visual feedback during sync

### Deliberately excluded (not planned)

- Roles and permissions (read-only, kids vs adults)
- Offline-first / sync queues / offline conflict resolution
- Real-time editing of recipes (the classic conflict problem)
- Recipe versioning (the snapshot on the weekly plan covers most needs)
- Per-recipe forking between strangers / a public recipe library (a much
  larger product; not in the plan)

## Important principles to hold on to

- **Realtime only where it counts**: shopping list and weekly plan, not recipe
  editing
- **Simple conflict strategy**: last-write-wins at the row level, Supabase
  handles ordering
- **Snapshot over reference**: when it concerns data that must not change
  retroactively
- **Hide in the UI rather than limit the data model**: build the data model
  flexible, hide features in the UI if they are not ready

## Next steps

1. Set up the Supabase project with a minimal schema (only what the shopping
   list needs) – *done: project "prepeat", migration 0001 applied*
2. Design one screen in Figma – the shopping list is recommended, because it
   tests the data model, realtime and the most critical UX all at once
3. Set up the Expo project with TypeScript, NativeWind and the Supabase client
   – *done*
4. Have Claude Code build the screen from the Figma design via MCP
5. Evaluate the loop – how close is the result to the Figma design, how good is
   the generated code, what needs adjusting in the Figma setup

## Requirements before release

- Apple Developer Program ($99/year)
- A Mac with Xcode (for signing, also with Expo EAS)
- App Store Connect account
- Privacy policy (the app stores user data)
- App Store review – allow time for iterations
- A proper trademark search on "Prep+Eat" / "Prepeat" before launch

## Open questions

Things to decide before coding, but not necessarily before project setup:

- Should the shopping list be kept after the week is over (history), or
  archived/deleted?
- How is portion adjustment handled on the weekly plan? (the servings_override
  field is there, but the UX needs designing)
- Aisle/category on ingredients – a fixed list or free text?
