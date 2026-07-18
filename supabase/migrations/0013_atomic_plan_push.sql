-- Prep+Eat – make the plan to shopping-list push atomic (data-safety fix).
--
-- The reconciler ran as a string of separate REST writes on the device, with
-- no transaction (2026-07-18 review, finding #4). Three problems:
--   1. A kill mid-push left an entry with some contributions written; the
--      "skip an entry that already has contributions" guard then treated it
--      as done, so the rest of that meal's ingredients were lost for good.
--   2. Two phones merging into the same line did read-then-write on the
--      quantity and lost each other's addition.
--   3. Nothing stopped two concurrent pushes creating duplicate lines for
--      the same name+unit.
--
-- Moving the contribute + push paths into these functions fixes all three:
-- each runs in one transaction (all-or-nothing per entry, so the idempotency
-- guard is now reliable), and an advisory lock per list serialises concurrent
-- reconciliation so merges and new-line creation can't race. As a bonus the
-- whole push is one round trip instead of ~100.
--
-- withdraw/rescale stay on the client for now (their own findings, #5/#10);
-- they get the same treatment when those land.
--
-- SECURITY INVOKER (the default): these touch only household-scoped tables the
-- caller already has full RLS access to, so no privilege escalation is needed.

-- ---------------------------------------------------------------------------
-- Shared key helpers – the SQL twins of normalizeItemName / itemKey in
-- src/lib/shopping-core.ts and plan-shopping.ts. Kept as functions so the
-- rule lives in one place and the merge key can never drift between them.
-- ---------------------------------------------------------------------------

create or replace function public.norm_item_name(p_name text)
returns text
language sql
immutable
as $$
  -- Trim, collapse whitespace (incl. non-breaking spaces), lowercase.
  select lower(
    trim(regexp_replace(replace(coalesce(p_name, ''), E'\u00A0', ' '), '\s+', ' ', 'g'))
  );
$$;

create or replace function public.item_merge_key(p_name text, p_unit text)
returns text
language sql
immutable
as $$
  select public.norm_item_name(p_name) || ' ' || coalesce(lower(trim(p_unit)), '');
$$;

-- ---------------------------------------------------------------------------
-- resolve_week_list: the SQL twin of getOrCreateListId – find this week's
-- list for the household or create it, racing safely against the unique index.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_week_list(
  p_household_id uuid,
  p_week date
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_list_id uuid;
begin
  select id into v_list_id
  from shopping_lists
  where household_id = p_household_id
    and week_start_date = p_week
    and deleted_at is null
  limit 1;
  if v_list_id is not null then
    return v_list_id;
  end if;

  begin
    insert into shopping_lists (household_id, created_by_user_id, week_start_date)
    values (p_household_id, auth.uid(), p_week)
    returning id into v_list_id;
  exception when unique_violation then
    -- Another phone created this week's list first – use theirs.
    select id into v_list_id
    from shopping_lists
    where household_id = p_household_id
      and week_start_date = p_week
      and deleted_at is null
    limit 1;
  end;
  return v_list_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- contribute_entry_into: merge one entry's scaled ingredients into a list.
-- Assumes the caller already holds the list's advisory lock. Returns the
-- number of ingredient lines touched. Mirrors the old contributeEntry rails:
--   clean line (unchecked, not hand-edited) -> quantity grows in place
--   checked / hand-edited line              -> left as is (contribution still
--                                              recorded, so the marker shows)
-- ---------------------------------------------------------------------------

create or replace function public.contribute_entry_into(
  p_list_id uuid,
  p_entry_id uuid
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_household_id uuid;
  v_servings integer;
  v_recipe_servings integer;
  v_factor numeric;
  v_touched integer := 0;
  v_ing record;
  v_item record;
  v_item_id uuid;
  v_aisle text;
begin
  -- Idempotent: an entry that already has contributions is fully done. Because
  -- this runs in one transaction, "some but not all" can never be observed.
  if exists (
    select 1 from shopping_list_item_contributions where entry_id = p_entry_id
  ) then
    return 0;
  end if;

  select p.household_id, e.servings, e.recipe_servings
    into v_household_id, v_servings, v_recipe_servings
  from meal_plan_entries e
  join meal_plans p on p.id = e.meal_plan_id
  where e.id = p_entry_id and e.deleted_at is null;
  if not found then
    return 0;
  end if;
  v_factor := case when v_recipe_servings > 0
                   then v_servings::numeric / v_recipe_servings
                   else 1 end;

  -- One row per name+unit key: display name/unit from the first occurrence
  -- (by sort_order); quantity is the summed scaled amount, or null when every
  -- occurrence is unparseable (contributes presence, not amount).
  for v_ing in
    with scaled as (
      select
        public.item_merge_key(name, unit) as key,
        name,
        unit,
        sort_order,
        case when quantity is null then null
             else round(quantity * v_factor, 2) end as sq
      from meal_plan_entry_ingredients
      where entry_id = p_entry_id
    ),
    firsts as (
      select distinct on (key) key, name, unit
      from scaled
      order by key, sort_order
    )
    select
      f.key,
      f.name,
      f.unit,
      (
        select case when count(s.sq) = 0 then null else round(sum(s.sq), 2) end
        from scaled s
        where s.key = f.key
      ) as quantity
    from firsts f
  loop
    -- Merge into the oldest live line with this key, locked so a concurrent
    -- reconcile serialises on it.
    select sli.id, sli.quantity, sli.is_checked, sli.edited_manually
      into v_item
    from shopping_list_items sli
    where sli.list_id = p_list_id
      and sli.deleted_at is null
      and public.item_merge_key(sli.name, sli.unit) = v_ing.key
    order by sli.created_at
    limit 1
    for update;

    if found then
      insert into shopping_list_item_contributions (item_id, entry_id, quantity)
      values (v_item.id, p_entry_id, v_ing.quantity);
      if not v_item.is_checked
         and not v_item.edited_manually
         and v_ing.quantity is not null then
        update shopping_list_items
          set quantity = round(coalesce(v_item.quantity, 0) + v_ing.quantity, 2)
        where id = v_item.id;
      end if;
    else
      v_item_id := gen_random_uuid();
      select icm.aisle into v_aisle
      from item_category_memory icm
      where icm.household_id = v_household_id
        and icm.name = public.norm_item_name(v_ing.name)
      limit 1;
      insert into shopping_list_items (
        id, list_id, name, quantity, unit, aisle, added_manually, created_by_user_id
      ) values (
        v_item_id, p_list_id, v_ing.name, v_ing.quantity, v_ing.unit,
        v_aisle, false, auth.uid()
      );
      insert into shopping_list_item_contributions (item_id, entry_id, quantity)
      values (v_item_id, p_entry_id, v_ing.quantity);
    end if;

    v_touched := v_touched + 1;
  end loop;

  return v_touched;
end;
$$;

-- ---------------------------------------------------------------------------
-- contribute_entry: one entry flows into its week's list (A + rails, used when
-- a meal is added to an already-pushed plan). Resolves + locks the list.
-- ---------------------------------------------------------------------------

create or replace function public.contribute_entry(p_entry_id uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_household_id uuid;
  v_week date;
  v_list_id uuid;
begin
  select p.household_id, p.week_start_date
    into v_household_id, v_week
  from meal_plan_entries e
  join meal_plans p on p.id = e.meal_plan_id
  where e.id = p_entry_id and e.deleted_at is null;
  if not found then
    return 0;
  end if;

  v_list_id := public.resolve_week_list(v_household_id, v_week);
  perform pg_advisory_xact_lock(hashtext('shopping_list:' || v_list_id::text)::bigint);
  return public.contribute_entry_into(v_list_id, p_entry_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- push_plan_to_list: "Add all to shopping list" – sweep every live entry into
-- the plan's week list and stamp pushed_to_list_at. Idempotent (already
-- contributed entries are skipped) and atomic (one transaction, one lock).
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

  update meal_plans
    set pushed_to_list_at = now()
  where id = p_plan_id
    and pushed_to_list_at is null;

  return v_total;
end;
$$;

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run so the whole file executes. Expect all five columns = true.
select
  exists (select 1 from pg_proc where proname = 'norm_item_name') as norm_fn,
  exists (select 1 from pg_proc where proname = 'resolve_week_list') as resolve_fn,
  exists (select 1 from pg_proc where proname = 'contribute_entry_into') as contribute_into_fn,
  exists (select 1 from pg_proc where proname = 'contribute_entry') as contribute_fn,
  exists (select 1 from pg_proc where proname = 'push_plan_to_list') as push_fn;
