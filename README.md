# Prep+Eat

Meal planning for families: recipes, a weekly plan, and a shared shopping
list that syncs in real time across household members.

*Prep. Eat. Repeat.*

The project foundation – decisions, data model and scope – lives in
[docs/projektgrundlag.md](docs/projektgrundlag.md) (in Danish; it predates the
decision to target an international audience).

## Stack

- [Expo](https://expo.dev) (React Native) + TypeScript
- [NativeWind](https://www.nativewind.dev) (Tailwind for React Native)
- [Supabase](https://supabase.com) – Postgres, Realtime, Auth, RLS

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and fill in the Supabase keys
   (Project Settings → API in the Supabase dashboard).

3. Run the database migrations in `supabase/migrations/` against your
   Supabase project (via the SQL editor or `supabase db push`).

4. Start the dev server:

   ```bash
   npm start
   ```

   Press `i` to open the iOS simulator.

## Structure

- `src/app/` – screens (expo-router, file-based routing)
- `src/components/` – shared UI components
- `src/lib/` – Supabase client and data access
- `supabase/migrations/` – database schema, numbered SQL migrations
- `docs/` – project foundation and decisions
