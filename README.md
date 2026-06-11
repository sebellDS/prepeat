# Madapp

Madplanlægning for familier: opskrifter, ugeplan og en delt indkøbsliste med
real-time sync mellem husstandens medlemmer.

Projektgrundlaget – beslutninger, datamodel og scope – ligger i
[docs/projektgrundlag.md](docs/projektgrundlag.md).

## Stack

- [Expo](https://expo.dev) (React Native) + TypeScript
- [NativeWind](https://www.nativewind.dev) (Tailwind til React Native)
- [Supabase](https://supabase.com) – Postgres, Realtime, Auth, RLS

## Kom i gang

1. Installer afhængigheder:

   ```bash
   npm install
   ```

2. Opret `.env` ud fra `.env.example` og udfyld Supabase-nøglerne
   (Project Settings → API i Supabase-dashboardet).

3. Kør database-migrationerne i `supabase/migrations/` mod dit
   Supabase-projekt (via SQL-editoren eller `supabase db push`).

4. Start dev-serveren:

   ```bash
   npm start
   ```

   Tryk `i` for at åbne iOS-simulatoren.

## Struktur

- `src/app/` – skærme (expo-router, file-based routing)
- `src/components/` – delte UI-komponenter
- `src/lib/` – Supabase-klient og dataadgang
- `supabase/migrations/` – databaseskema, nummererede SQL-migrationer
- `docs/` – projektgrundlag og beslutninger
