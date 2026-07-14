-- Prep+Eat – recipes (the recipes milestone, designs landed 2026-07-12).
-- Household-owned per projektgrundlag decision #3: everything in a household
-- is shared by definition; created_by_user_id carries quiet attribution.
-- Favorites are shared household favorites (decided 2026-07-12): one heart
-- for the family, so it lives as a flag on the recipe row itself.
-- No realtime on any of these tables – recipe editing is deliberately not
-- a realtime surface (the classic conflict problem; last write wins).

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by_user_id uuid not null references auth.users (id),
  title text not null,
  description text,
  servings integer not null default 4,
  prep_minutes integer,
  cook_minutes integer,
  image_url text,
  source_url text,
  -- Set when the recipe is a copy (copy-on-leave, later copy-to-my-kitchen).
  forked_from_recipe_id uuid references public.recipes (id),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index recipes_household_id_idx on public.recipes (household_id);

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  -- Split like shopping_list_items: numeric amount + unit text. Parsed from
  -- one free-text field in the app ("250 g" → 250 + 'g'); unparseable
  -- quantities ("a pinch") store as unit only and never scale.
  quantity numeric,
  unit text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients (recipe_id);

create trigger recipe_ingredients_set_updated_at
  before update on public.recipe_ingredients
  for each row execute function public.set_updated_at();

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  step_number integer not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipe_steps_recipe_id_idx on public.recipe_steps (recipe_id);

create trigger recipe_steps_set_updated_at
  before update on public.recipe_steps
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: full access for household members, same pattern as the
-- shopping list. Child tables check membership through their recipe.
-- ---------------------------------------------------------------------------

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

create policy recipes_all on public.recipes
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy recipe_ingredients_all on public.recipe_ingredients
  for all using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and public.is_household_member(r.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and public.is_household_member(r.household_id)
    )
  );

create policy recipe_steps_all on public.recipe_steps
  for all using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and public.is_household_member(r.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id
        and public.is_household_member(r.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Recipe photos: one public-read bucket, uploads namespaced per household
-- (path: <household_id>/<recipe_id>.jpg). Members write their household's
-- folder; anyone can read (image URLs are unguessable UUIDs).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

create policy recipe_photos_read on storage.objects
  for select using (bucket_id = 'recipe-photos');

create policy recipe_photos_insert on storage.objects
  for insert with check (
    bucket_id = 'recipe-photos'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy recipe_photos_update on storage.objects
  for update using (
    bucket_id = 'recipe-photos'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy recipe_photos_delete on storage.objects
  for delete using (
    bucket_id = 'recipe-photos'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
