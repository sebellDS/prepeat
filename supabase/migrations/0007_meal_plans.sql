-- Prep+Eat – weekly meal plans (the Plan milestone, designs landed 2026-07-16).
-- Household-owned like everything else. One plan row per household per week
-- (week_start_date is always a Monday). Days hold a flat list of meals – no
-- breakfast/lunch/dinner distinction in v1 (decided 2026-07-16); meal_type is
-- carried for the agreed data model but stays null for now.
--
-- Ingredients are SNAPSHOTTED onto the plan at add time (core principle:
-- the plan never reads ingredients live from recipes). Quantities are stored
-- at the recipe's own servings; the entry keeps that anchor in
-- recipe_servings, so scaling is always servings / recipe_servings with no
-- compounding rounding when servings change later.
--
-- Plan → shopping list follows "A + rails" (decided 2026-07-16): once a week
-- has been pushed to the shopping list (pushed_to_list_at), plan edits
-- live-reconcile into it. Merged list lines need to know which entries fed
-- them, so contributions get their own table – this supersedes the
-- shopping_list_items.source_entry_id placeholder from 0001, which stays
-- unused.

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start_date date not null,
  created_by_user_id uuid not null references auth.users (id),
  -- Null until "Add all to shopping list"; after that every plan edit
  -- reconciles into the list automatically (A + rails).
  pushed_to_list_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index meal_plans_household_id_idx on public.meal_plans (household_id);

-- One live plan per household per week.
create unique index meal_plans_household_week_idx
  on public.meal_plans (household_id, week_start_date)
  where deleted_at is null;

create trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  date date not null,
  -- In the agreed data model (breakfast/lunch/dinner/snack) but unused in v1:
  -- days are a flat list of meals (decided 2026-07-16).
  meal_type text,
  recipe_id uuid not null references public.recipes (id),
  -- Chosen on the add-meal sheet; the amount this meal is planned for.
  servings integer not null,
  -- The recipe's own servings at snapshot time – the scaling anchor.
  -- Ingredient quantities below are stored at THIS servings count.
  recipe_servings integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index meal_plan_entries_meal_plan_id_idx
  on public.meal_plan_entries (meal_plan_id);

create trigger meal_plan_entries_set_updated_at
  before update on public.meal_plan_entries
  for each row execute function public.set_updated_at();

create table public.meal_plan_entry_ingredients (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.meal_plan_entries (id) on delete cascade,
  name text not null,
  -- Same split as recipe_ingredients: numeric amount + unit text, quantities
  -- at the recipe's base servings. Unparseable amounts ("a pinch") store as
  -- unit only and never scale.
  quantity numeric,
  unit text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_plan_entry_ingredients_entry_id_idx
  on public.meal_plan_entry_ingredients (entry_id);

create trigger meal_plan_entry_ingredients_set_updated_at
  before update on public.meal_plan_entry_ingredients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Shopping-list contributions: which plan entries feed which list line.
-- A merged line ("Onions" from Wednesday soup + Friday pasta) has one row per
-- contributing entry, each holding that entry's scaled share, so a single
-- meal's change rescales only its share. quantity is null when the source
-- amount is unparseable (contributes presence, not amount).
-- ---------------------------------------------------------------------------

create table public.shopping_list_item_contributions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.shopping_list_items (id) on delete cascade,
  entry_id uuid not null references public.meal_plan_entries (id) on delete cascade,
  quantity numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, entry_id)
);

create index shopping_list_item_contributions_item_id_idx
  on public.shopping_list_item_contributions (item_id);
create index shopping_list_item_contributions_entry_id_idx
  on public.shopping_list_item_contributions (entry_id);

create trigger shopping_list_item_contributions_set_updated_at
  before update on public.shopping_list_item_contributions
  for each row execute function public.set_updated_at();

-- Rail: a hand-edited line is never overwritten by the reconciler. Set when
-- the user edits name/quantity/unit of a plan-generated line.
alter table public.shopping_list_items
  add column edited_manually boolean not null default false;

-- ---------------------------------------------------------------------------
-- Row-level security: full access for household members, same pattern as
-- recipes/shopping. Child tables check membership through their parent.
-- ---------------------------------------------------------------------------

alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.meal_plan_entry_ingredients enable row level security;
alter table public.shopping_list_item_contributions enable row level security;

create policy meal_plans_all on public.meal_plans
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy meal_plan_entries_all on public.meal_plan_entries
  for all using (
    exists (
      select 1 from public.meal_plans p
      where p.id = meal_plan_id
        and public.is_household_member(p.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.meal_plans p
      where p.id = meal_plan_id
        and public.is_household_member(p.household_id)
    )
  );

create policy meal_plan_entry_ingredients_all on public.meal_plan_entry_ingredients
  for all using (
    exists (
      select 1 from public.meal_plan_entries e
      join public.meal_plans p on p.id = e.meal_plan_id
      where e.id = entry_id
        and public.is_household_member(p.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.meal_plan_entries e
      join public.meal_plans p on p.id = e.meal_plan_id
      where e.id = entry_id
        and public.is_household_member(p.household_id)
    )
  );

create policy shopping_list_item_contributions_all
  on public.shopping_list_item_contributions
  for all using (
    exists (
      select 1 from public.shopping_list_items i
      join public.shopping_lists l on l.id = i.list_id
      where i.id = item_id
        and public.is_household_member(l.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.shopping_list_items i
      join public.shopping_lists l on l.id = i.list_id
      where i.id = item_id
        and public.is_household_member(l.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: the meal plan is a realtime surface like the shopping list
-- (decided in projektgrundlag). Plans themselves too, so a week created on
-- one phone appears on the other. Entry ingredients and contributions are
-- not subscribed – they are read on demand.
-- ---------------------------------------------------------------------------

alter table public.meal_plans replica identity full;
alter table public.meal_plan_entries replica identity full;

alter publication supabase_realtime add table public.meal_plans;
alter publication supabase_realtime add table public.meal_plan_entries;
