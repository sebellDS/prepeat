-- 0021: every week's shopping list follows its plan (projektgrundlag #8,
-- decided 2026-07-25).
--
-- The "Add all to shopping list" opt-in is gone. A meal now contributes to its
-- week's list the moment it is planned, and resolve_week_list (0013) creates
-- that list on demand – so planning a week IS asking for its shopping list.
--
-- Weeks planned BEFORE this change were never linked (pushed_to_list_at null),
-- so their ingredients never reached a list and, with no button left to press,
-- never would. Sweep them in once here.
--
-- Safe to re-run: push_plan_to_list is idempotent (entries that already
-- contributed are skipped) and only stamps pushed_to_list_at when it is null.
-- The column itself is vestigial from here on – nothing in the app reads it.

do $$
declare
  v_plan record;
  v_plans integer := 0;
  v_lines integer := 0;
begin
  for v_plan in
    select id
    from meal_plans
    where deleted_at is null
      and pushed_to_list_at is null
    order by week_start_date
  loop
    v_lines := v_lines + public.push_plan_to_list(v_plan.id);
    v_plans := v_plans + 1;
  end loop;
  raise notice 'reconciled % plan week(s), % new list line(s)', v_plans, v_lines;
end;
$$;

-- Verifying SELECT (lesson from 0008/0010): click once in the editor to clear
-- any selection before Run, so the whole file executes.
-- Expect unlinked_weeks = 0.
select
  count(*) filter (where pushed_to_list_at is null) as unlinked_weeks,
  count(*) as total_weeks
from meal_plans
where deleted_at is null;
