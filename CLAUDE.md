@AGENTS.md

# Prep+Eat

**The project owner is not a developer.** Claude does all coding and terminal
work; explain technical matters in plain language, give click-by-click steps
when the owner must do something himself (accounts, websites, simulators), and
frame decisions as product trade-offs rather than technical ones.

Meal-planning app for families: recipes, weekly meal plan, auto-generated
shopping list with real-time sync across household members. Target: iOS App
Store first, Android later.

**Read [docs/projektgrundlag.md](docs/projektgrundlag.md) before making product
or data-model decisions.** It records the agreed scope (v1 vs later vs
deliberately excluded), the data model, and the core principles. The app's UI
language is English and it targets an international audience.

**The work list lives in [docs/backlog.md](docs/backlog.md).** Keep it
current: check items off as they land, add new tasks and ideas there (with
attribution and date for ideas), and consult it when the owner asks what's
next.

The app is named **Prep+Eat** (decided 2026-06-12): "Prep+Eat" is the visual
wordmark (the + is the brand mark), "Prepeat" (pronounced PREP-eat) is the
plain-text form used for slug, scheme, domains and handles. Tagline: "Prep.
Eat. Repeat." The old working name "Madapp" may linger in docs/projektgrundlag.

## Stack

- Expo SDK 56 (React Native, expo-router, React Compiler enabled), TypeScript
- NativeWind v4 (Tailwind 3.4) – global CSS at `src/global.css`, config in
  `tailwind.config.js`. Put new design tokens in the Tailwind theme, never
  hardcoded in components.
- Supabase: Postgres + Realtime + Auth + RLS. Client at `src/lib/supabase.ts`,
  schema migrations in `supabase/migrations/`.
- Figma MCP for design-to-code: screens are designed in Figma and implemented
  from frames via the Figma integration.

## Commands

- `npm start` – Expo dev server (then i for iOS simulator)
- `npm run lint` – ESLint via expo lint
- `npx tsc --noEmit` – typecheck

## Conventions

- Screens live in `src/app/` (expo-router file-based routing); shared UI in
  `src/components/`; data access and clients in `src/lib/`.
- Env vars go in `.env` (gitignored), documented in `.env.example`. Only
  `EXPO_PUBLIC_`-prefixed vars reach the client – never put secrets there
  beyond the Supabase anon key.
- Database changes are always a new numbered file in `supabase/migrations/` –
  never edit an applied migration.
- Every table needs RLS policies in the same migration that creates it.
  Household-scoped access goes through `is_household_member()`.
- Key data-model principles (from projektgrundlag): ingredients are
  snapshotted onto the meal plan (never read live from recipes), soft delete
  via `deleted_at`, last-write-wins concurrency via `updated_at`. Recipes,
  meal plans and shopping lists are all owned by the household; recipes carry
  `created_by_user_id` for attribution and use copy-on-leave so a departing
  member keeps a snapshot. Every user always belongs to at least one
  household.
- Realtime only where it matters: shopping list and meal plan. Not recipe
  editing.

## Writing style

- Never use em-dashes (—); use an en-dash (–) instead, in prose, code comments
  and commit messages.
