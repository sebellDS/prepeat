# Madapp – Projektgrundlag

Et samlet dokument over beslutninger, stack og datamodel for en familie-mad-app. Udgangspunkt for videre arbejde i et dedikeret projekt.

## Appens formål

En mobilapp til madplanlægning for familier. Kernefunktionalitet:

- **Opskrifter**: tilføjes manuelt eller importeres fra URL
- **Ugeplan**: planlægning af måltider for en uge ad gangen
- **Indkøbsliste**: genereres automatisk fra ugeplanen, kan også redigeres manuelt
- **Familiedeling**: flere familiemedlemmer deler opskrifter, ugeplan og indkøbsliste
- **Real-time sync**: afkrydsning i indkøbslisten på én telefon opdateres øjeblikkeligt på de andres

Målet er udgivelse på App Store (iOS), eventuelt Android senere.

## Teknologivalg

**Platform: React Native via Expo**

Ingen af appens features kræver native iOS. Real-time sync, URL-parsing og delt data er alle områder, hvor React Native-økosystemet er stærkt eller stærkere end native. Expo fjerner det meste af besværet omkring iOS-signering og App Store-udgivelse via EAS Build. Android kan tilføjes senere uden at bygge alt om.

### Stack

- **Expo** (React Native-rammen)
- **TypeScript** – bedre AI-genereret kode, tidlig fejlfangst
- **Supabase** – Postgres, realtime, auth og row-level security i én pakke
- **NativeWind** (Tailwind til React Native) – hvis Figma-designet bruger Tailwind-tokens, oversætter det pænt
- **Supabase Edge Functions** – til backend URL-parsing

### Workflow

- Design i Figma med Auto Layout, navngivne komponenter og variables til farver/typografi
- Claude Code læser Figma-frames via Figma MCP-integration og bygger skærmene
- Git-versioneret kode, committet af udvikleren efter review

## Kernebeslutninger (datamodel)

### 1. Opskrifter ejes personligt, ikke af husstanden

Spejler hvordan folk faktisk tænker ("det er min mors opskrift"). Opskrifter deles med en husstand, men ejes af en bruger. Ved fraflytning tager brugeren sine opskrifter med.

### 2. Flere husstande pr. bruger (i datamodellen, skjult i v1-UI)

Datamodellen understøtter, at en bruger kan være i flere husstande (relevant for skilte forældre, bofællesskaber osv.). I v1 viser UI'et kun én husstand for at holde kompleksiteten nede. Det koster stort set intet i datamodellen og undgår smertefuld migration senere.

### 3. Ugeplan og indkøbsliste ejes af husstanden

Det er hele pointen med delingen.

### 4. Ingredienser "snapshottes" ved planlægning

Når en opskrift sættes på ugeplanen, kopieres ingredienserne ind i `meal_plan_entry_ingredients`. Indkøbslisten læser fra snapshots, ikke fra opskriften selv. Det betyder at ændringer eller sletning af en opskrift ikke bryder ugeplan eller indkøbsliste – samme princip som en faktura-linje, der ikke må ændre sig.

### 5. Ingen roller i v1

Alle husstandsmedlemmer er ligeværdige. Der er ingen owner/member-distinktion. Rolle-kolonnen kan tilføjes senere hvis behovet opstår.

## Datamodel

### Brugere og husstande

- `users` – håndteres primært af Supabase Auth
- `households` – id, name, created_at, updated_at
- `household_members` – user_id, household_id, joined_at (join-tabel)
- `household_invites` – id, household_id, code (unik), created_by, expires_at, used_at, used_by_user_id

### Opskrifter

- `recipes` – id, owner_user_id, title, description, source_url, servings, prep_time, cook_time, image_url, created_at, updated_at, deleted_at
- `recipe_ingredients` – id, recipe_id, name, quantity, unit, note, sort_order, aisle/category (optional)
- `recipe_steps` – id, recipe_id, step_number, text
- `recipe_shares` – recipe_id, household_id (hvilke husstande en opskrift er delt med)

### Måltidsplanlægning

- `meal_plans` – id, household_id, week_start_date (mandag), created_at, updated_at, deleted_at
- `meal_plan_entries` – id, meal_plan_id, date, meal_type (breakfast/lunch/dinner/snack), recipe_id, servings_override
- `meal_plan_entry_ingredients` – id, entry_id, name, quantity, unit, note (snapshot fra opskriften på planlægningstidspunktet)

### Indkøbsliste

- `shopping_lists` – id, household_id, name, week_start_date (optional), created_at, updated_at, deleted_at
- `shopping_list_items` – id, list_id, name, quantity, unit, aisle, is_checked, checked_by_user_id, checked_at, added_manually (bool), source_entry_id (nullable, peger på meal_plan_entry hvis auto-genereret), updated_at

### Gennemgående felter

- `created_at`, `updated_at`, `created_by_user_id` på alle hovedtabeller
- `deleted_at` (soft delete) på recipes, shopping_lists, meal_plans
- `updated_at` er kritisk for "last write wins" concurrency

## Scope i v1

### Med i v1 (MVP)

- Personlige opskrifter (manuel oprettelse + URL-import med schema.org fallback)
- Én husstand pr. bruger i UI (multi-household i datamodel)
- Ugeplan pr. uge
- Indkøbsliste genereret fra ugeplan + manuel tilføjelse
- Real-time sync af indkøbslisten og ugeplanen
- Invite-flow via link/kode
- Simpel ingrediens-sammenlægning (match på trimmet, lowercased name + unit)
- Snapshot af ingredienser ved planlægning
- Optimistic updates og loading states i indkøbslisten
- Soft deletes
- "Last write wins" concurrency

### Senere (v1.1+)

- Multi-household UI
- Avanceret ingrediens-normalisering ("løg" vs "gule løg", g ↔ kg)
- Backend URL-parsing robusthed
- Bedre visuel feedback under sync

### Bevidst udeladt (ikke i planen)

- Roller og permissions (read-only, børn vs voksne)
- Offline-first / sync queues / conflict resolution offline
- Realtime-redigering af opskrifter (klassisk konflikt-problem)
- Versionering af opskrifter (snapshot på ugeplanen dækker de fleste behov)

## Vigtige principper at holde fast i

- **Realtime kun hvor det tæller**: indkøbsliste og ugeplan, ikke opskriftsredigering
- **Simpel konfliktstrategi**: last-write-wins på række-niveau, Supabase håndterer rækkefølge
- **Snapshot frem for reference**: når det handler om data der ikke må ændre sig retroaktivt
- **UI-skjul frem for datamodel-begrænsning**: byg datamodellen fleksibel, skjul features i UI hvis de ikke er klar

## Næste skridt

1. Opsæt Supabase-projekt med minimalt skema (kun det indkøbslisten behøver)
2. Design én skærm i Figma – indkøbslisten anbefales, fordi den tester både datamodel, realtime og den mest kritiske UX på én gang
3. Opsæt Expo-projekt med TypeScript, NativeWind og Supabase-klient
4. Lad Claude Code bygge skærmen ud fra Figma-designet via MCP
5. Evaluer loopet – hvor tæt er resultatet på Figma-designet, hvor god er den genererede kode, hvad skal justeres i Figma-setuppet

## Krav før udgivelse

- Apple Developer Program ($99/år)
- Mac med Xcode (til signering, også med Expo EAS)
- App Store Connect-konto
- Privacy policy (appen gemmer brugerdata)
- App Store review – afsæt tid til iterationer

## Åbne spørgsmål

Ting der skal besluttes før kodning, men ikke nødvendigvis før projektopsætning:

- Skal opskrifter kunne kopieres mellem brugere (fork), eller kun deles med read-adgang via husstanden?
- Skal indkøbslisten kunne gemmes til efter ugen er gået (historik), eller arkiveres/slettes?
- Hvordan håndteres portionsjustering på ugeplanen? (servings_override-feltet er der, men UX'en skal designes)
- Aisle/kategori på ingredienser – fast liste eller fri tekst?
