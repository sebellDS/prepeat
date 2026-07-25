-- Prep+Eat – reorder recipe ingredients/steps in one atomic write (data safety).
--
-- reorderIngredients() / reorderSteps() in src/lib/recipes.ts persisted a
-- drag-reorder as one REST UPDATE per row in a client-side loop (2026-07-18
-- review). A 20-item reorder was 20 sequential round trips with no
-- transaction, so a kill / backgrounding / network drop mid-loop left the
-- order HALF-SAVED – the first rows renumbered, the rest on their old
-- sort_order – and that wrong order then persists and reloads. Slow, too.
--
-- These functions renumber the whole list from the caller's ordered id array
-- in a single UPDATE. array_position gives each row its slot in the array, so
-- one statement (one transaction, all-or-nothing) reseats every row. There is
-- no unique constraint on (recipe_id, sort_order) / (recipe_id, step_number),
-- so a single-statement renumber can't hit a transient collision.
--
-- SECURITY INVOKER (the default): they touch only household-scoped rows the
-- caller already has full RLS UPDATE access to (recipe_ingredients_all /
-- recipe_steps_all in 0006). Ids the caller can't see are filtered out by RLS
-- and simply not touched – no privilege escalation, same trust model as the
-- old client loop.

-- sort_order is 0-based (array_position is 1-based → minus one).
create or replace function public.reorder_recipe_ingredients(p_ids uuid[])
returns void
language sql
as $$
  update public.recipe_ingredients
     set sort_order = array_position(p_ids, id) - 1
   where id = any(p_ids);
$$;

-- step_number is 1-based, so array_position maps straight across.
create or replace function public.reorder_recipe_steps(p_ids uuid[])
returns void
language sql
as $$
  update public.recipe_steps
     set step_number = array_position(p_ids, id)
   where id = any(p_ids);
$$;

-- Verifying SELECT (lesson from 0008/0010/0012): click once to clear any
-- selection before Run so the whole file executes. Expect true / true.
select
  exists (select 1 from pg_proc where proname = 'reorder_recipe_ingredients') as ingredients_rpc,
  exists (select 1 from pg_proc where proname = 'reorder_recipe_steps') as steps_rpc;
