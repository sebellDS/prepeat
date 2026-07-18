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
- `./scripts/build-iphone.sh` – build + install the Release app on
  Thomas's iPhone (cabled + unlocked). Prints timestamped phases and
  exits when installed – never use raw `expo run:ios` for device builds
  (it tails logs forever and reads as a hung build). Run it in the
  background WITHOUT piping (a pipe buffers the log until exit) and
  watch the task output file with a Monitor for phase/error lines.

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

## Design system workflow (agreed 2026-07-12)

The app is a testbed for the Sebell DS, which is still under development.
The DS is the source of truth for every colour, radius, spacing and type
value – not the hex numbers visible in Figma frames (published library
values in Figma lag behind the DS repo).

1. **Never improvise a token.** If a screen needs a token family that is
   not in `src/constants/ds-theme.cjs` yet (like forms/* before
   2026-07-12), stop and add the group to the export list in the DS repo
   (`packages/tokens/transforms/generate-nativewind.mjs`), run
   `npm run tokens:build` there, then `npm run sync-ds-tokens` here.
   Approximating with a neighbouring token silently drifts when the DS is
   retuned.
2. **After every DS publish or retune**, re-run the token build + sync,
   diff `ds-theme.cjs` and walk the affected screens. The owner saying
   "DS published" is the trigger (also under Recurring in the backlog).
3. **Interactive states are built, not inherited.** React Native has no
   hover/focus CSS – every state a component shows must be coded
   explicitly. When implementing a component, check its Figma frames for
   all states (default/active/error/disabled) and map web-ish token names
   (`hover`) to their touch meaning (focused/pressed). Text inputs share
   `src/components/ui/input.tsx` so the active state cannot drift apart.
4. **Build the design, never an approximation of it** (Thomas, 2026-07-17,
   after the multi-day sheets shipped with an invented switch, header and
   row style). The on-device app is the instrument Thomas judges his
   design with – an improvised implementation makes design flaws
   invisible and reviews meaningless, on top of the wasted correction
   rounds. Concretely: before writing UI code, fetch `get_design_context`
   for EVERY sheet/screen/state being implemented (screenshots and
   metadata are for review conversations, not specs). Where a design
   genuinely has a gap (a state not drawn, a flow not designed), say so
   and mark the improvisation in the backlog – never quietly fill the gap
   and let it read as Thomas's design.

## Writing style

- Never use em-dashes (—); use an en-dash (–) instead, in prose, code comments
  and commit messages.
