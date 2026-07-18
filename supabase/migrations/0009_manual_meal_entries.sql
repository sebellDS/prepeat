-- Manual meals ("Leftovers", "Eating out") on the plan – designed 2026-07-18
-- (Figma section 142:15357, the Recipes/Manual toggle on the add-meal sheet).
-- This settles the question left open in the 2026-07-16 review: recipe-less
-- meals ARE allowed.
--
-- A manual entry is just a name on a day: recipe_id becomes nullable and the
-- name lives in the new title column. Manual entries snapshot no ingredients
-- and therefore never contribute to the shopping list. servings stays not
-- null (manual entries store 1) – the UI hides servings for them.

alter table public.meal_plan_entries
  alter column recipe_id drop not null;

alter table public.meal_plan_entries
  add column title text;

-- Every entry is either a recipe meal or a named manual meal.
alter table public.meal_plan_entries
  add constraint meal_plan_entries_recipe_or_title
  check (recipe_id is not null or title is not null);

-- Verifying SELECT (lesson from 0008: success must be visible). Expect one
-- row: title_column_exists = true, recipe_id_nullable = true.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meal_plan_entries'
      and column_name = 'title'
  ) as title_column_exists,
  (
    select is_nullable = 'YES' from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meal_plan_entries'
      and column_name = 'recipe_id'
  ) as recipe_id_nullable;
