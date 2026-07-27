-- 0022: drop two columns nothing reads any more (backlog code debt).
--
-- 1. households.image_url – added by 0010, but the household image was dropped
--    from the design 2026-07-22. No client query has selected or written it
--    since; verified 2026-07-27 across src/.
--
-- 2. meal_plans.pushed_to_list_at – the "has this week been pushed to the
--    shopping list" flag. Vestigial since decision #8 (2026-07-25) retired the
--    opt-in: every meal now contributes on write. 0021 used it once to find the
--    weeks needing a backfill, and that sweep has run.
--
-- push_plan_to_list still STAMPED that column, so it is replaced here first –
-- otherwise the function would break the moment the column went. The function
-- itself stays: it is the deliberate "reset this week's list" escape hatch
-- (fillFromWeeklyPlan), kept as the only repair path if a contribution ever
-- fails mid-write. It just stops writing a flag nobody reads. Its return value
-- (lines contributed) is unchanged, and it stays idempotent and atomic.
--
-- IRREVERSIBLE: dropping a column discards its data. Both columns are
-- meaningless now, but there is no undo short of a restore.

-- ---------------------------------------------------------------------------
-- push_plan_to_list, minus the stamp. Body otherwise identical to 0013.
-- ---------------------------------------------------------------------------
create or replace function public.push_plan_to_list(p_plan_id uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_household_id uuid;
  v_week date;
  v_list_id uuid;
  v_entry record;
  v_total integer := 0;
begin
  select household_id, week_start_date
    into v_household_id, v_week
  from meal_plans
  where id = p_plan_id;
  if not found then
    return 0;
  end if;

  v_list_id := public.resolve_week_list(v_household_id, v_week);
  perform pg_advisory_xact_lock(hashtext('shopping_list:' || v_list_id::text)::bigint);

  for v_entry in
    select id
    from meal_plan_entries
    where meal_plan_id = p_plan_id
      and deleted_at is null
  loop
    v_total := v_total + public.contribute_entry_into(v_list_id, v_entry.id);
  end loop;

  return v_total;
end;
$$;

alter table public.meal_plans drop column if exists pushed_to_list_at;
alter table public.households drop column if exists image_url;

-- Verifying SELECT (lesson from 0008/0010): click once in the editor to clear
-- any selection before Run, so the whole file executes.
-- Expect both columns_left = 0 and push_fn_present = true.
select
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'meal_plans' and column_name = 'pushed_to_list_at')
        or (table_name = 'households' and column_name = 'image_url')
      )
  ) as columns_left,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'push_plan_to_list'
  ) as push_fn_present;
