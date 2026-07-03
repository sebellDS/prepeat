-- Prep+Eat – learned shopping categories (projektgrundlag decision #7).
-- Each household teaches its own app which category an item name belongs in.
-- One row per (household, normalized name); the app writes the normalized
-- form (trimmed, lowercased – the same rule as ingredient merging) and
-- applies the mapping when items are added to a shopping list.
--
-- No realtime on this table: when a member assigns a category, the visible
-- effect is the update to shopping_list_items.aisle, which is already a
-- realtime surface.

create table public.item_category_memory (
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  aisle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, name)
);

create trigger item_category_memory_set_updated_at
  before update on public.item_category_memory
  for each row execute function public.set_updated_at();

alter table public.item_category_memory enable row level security;

-- Full access for household members, same pattern as shopping lists.
create policy item_category_memory_all on public.item_category_memory
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
