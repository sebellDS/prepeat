-- Prep+Eat – the shared list. Three small additions the live shopping list
-- needs on top of migration 0001:
--
-- 1. The household's category order (store-walk sorting) moves from device
--    storage to the household row, per the backlog.
-- 2. Items get soft delete (deleted_at, per projektgrundlag) so removals
--    sync between phones and an undo toast can restore them later.
-- 3. Items carry the checker's initial directly. Denormalized on purpose:
--    there is no profiles table yet, and members cannot read each other's
--    auth metadata – the checking phone knows its own initial and writes it.

alter table public.households
  add column category_order text[];

alter table public.shopping_list_items
  add column deleted_at timestamptz,
  add column checked_by_initial text;

-- v1 has exactly one active list per household (multiple week-based lists
-- are a later idea – week_start_date already exists for that). The unique
-- index lets two phones race to create the first list safely: the loser
-- gets a conflict and selects the winner's list instead.
create unique index shopping_lists_one_active_per_household
  on public.shopping_lists (household_id)
  where deleted_at is null;
