-- Prep+Eat – weekly shopping lists (designed 2026-07-16, same day as the
-- Plan milestone). The shopping list gets the same week navigation as the
-- plan: one list per household per week instead of one active list total.
-- week_start_date has been on shopping_lists since 0001 for exactly this.

-- The household's existing list becomes the current week's list, so nothing
-- the family has on it today is lost. date_trunc('week', …) is Monday-based,
-- matching the app's weekStartOf().
update public.shopping_lists
  set week_start_date = (date_trunc('week', now()))::date
  where week_start_date is null
    and deleted_at is null;

-- One list per household per week replaces one list per household. The
-- unique index still lets two phones race safely: the loser gets a conflict
-- and selects the winner's list.
drop index if exists public.shopping_lists_one_active_per_household;

create unique index shopping_lists_household_week_idx
  on public.shopping_lists (household_id, week_start_date)
  where deleted_at is null;
