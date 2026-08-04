-- 0029: what the plan STILL needs gets its own line, and a ticked-off line is
-- never touched again.
--
-- WHY 0028 WAS WRONG (Thomas, 2026-08-04, testing it the same afternoon)
-- He added "Test 1" three times, a recipe needing 1 litre of milk, so the line
-- merged to 3 l. He ticked it off. Then he doubled ONE of the three meals –
-- and the list said he needed 4 LITRES.
-- Four is the correct TOTAL (1 + 1 + 2). It is the wrong ANSWER. He had already
-- accounted for 3 litres; what he needed to know was "buy 1 more".
-- 0028 un-checked the line and put the new total on it, which answers "what does
-- the plan need" when the shopper is asking "what do I still have to get".
-- That was a choice made silently for the wrong reason: putting the total on the
-- one line kept 0025's bookkeeping simple. Simplicity of the invariant is not a
-- reason to show someone a number they have to do arithmetic against.
--
-- THE SHAPE OF THE PROBLEM
-- A line holds ONE number, and this situation has TWO facts: what the plan needs
-- (4) and what the shopper has already secured (3). Neither can be dropped – the
-- first is the requirement, the second is why the tick exists.
-- So they get a line each. Thomas chose this (option A of three, 2026-08-04):
-- the ticked line STAYS as the record of what is handled, and what is still
-- missing appears as its own active line.
--
-- THE NUMBER IS ALREADY IN THE DATA, and this is what makes it cheap. 0025 gave
-- every contribution both `quantity` (what the meal needs) and
-- `applied_quantity` (how much of that is folded into the visible line). So for
-- a ticked line:
--     still needed  =  SUM(quantity - coalesce(applied_quantity, 0))
-- A contribution added after the tick has applied = null, so all of it is
-- outstanding. A contribution whose meal was scaled up has quantity 2 against
-- applied 1, so 1 is outstanding. Nothing new is recorded; it is a query.
--
-- RECOMPUTED, NEVER INCREMENTED. This is the part that makes the reverse
-- operations work, and it is where an incremental version would rot: un-double
-- the meal and the sum returns to 0, so the extra line goes away by itself.
-- Same for removing the meal, halving it, or scaling twice in a row. Every
-- path was walked before this was written:
--     tick 3 l, double one of three meals   -> 3 l [ticked] + 1 l still needed
--     un-double it                          -> 3 l [ticked]
--     double two of them                    -> 3 l [ticked] + 2 l still needed
--     remove the doubled meal               -> 3 l [ticked]
--     tick the extra litre off too,
--       then double a SECOND meal           -> asks for 1 more, not 2
--     add a new meal after shopping         -> 2 l [ticked] + 1 l still needed
-- The last line is Thomas's original report – "it does not update shopping list
-- when adding a meal to plan" – fixed by the same mechanism.
--
-- WHAT THIS REVERTS
-- 0028's un-freezing, in both contribute_entry_into and rescale_entry. Those two
-- go back to 0025's rails exactly: a ticked line is left alone and records
-- applied = null. The rails were never the problem – the missing half was that
-- nothing told the shopper. Now something does, without touching their tick.
-- 0028's other decisions stand and are unchanged here: a DECREASE still never
-- disturbs anything (the sum simply drops), and a HAND-EDITED line is still
-- never overwritten.
--
-- SAFE FOR THE PHONES (the 0022 lesson): one nullable column ADDED, three
-- function bodies replaced, nothing dropped, no signature changed – so
-- TestFlight builds 12, 13 and 14 keep working. It needs NO app change either:
-- the outstanding line is an ordinary row, so an old build simply shows it as
-- another item on the list, which is precisely the intended behaviour. The
-- column is invisible to every client (fetchItems selects explicit columns).
-- This DOES change behaviour for everyone the moment it runs, including v1.0's
-- build 12 – intended, and a behaviour change rather than a compatibility one.

-- ---------------------------------------------------------------------------
-- The link from an outstanding line back to the ticked line it belongs to.
-- Nullable and unreferenced by any client, so old builds neither know nor care.
-- ---------------------------------------------------------------------------

alter table shopping_list_items
  add column if not exists outstanding_for uuid
    references shopping_list_items (id) on delete set null;

comment on column shopping_list_items.outstanding_for is
  'Set when this line exists only to say what the plan still needs beyond a '
  'ticked-off line, and points at that line. Maintained by '
  'sync_plan_outstanding – see migration 0029.';

create index if not exists shopping_list_items_outstanding_for_idx
  on shopping_list_items (outstanding_for)
  where outstanding_for is not null;

-- ---------------------------------------------------------------------------
-- sync_plan_outstanding: bring the "still needed" line for one ticked line into
-- agreement with the plan. Idempotent by construction – it computes the whole
-- number every time rather than adjusting by a delta.
-- ---------------------------------------------------------------------------

create or replace function public.sync_plan_outstanding(p_item_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_line record;
  v_outstanding numeric;
  v_satisfied numeric;
  v_need numeric;
  v_target record;
begin
  select id, list_id, name, unit, aisle, quantity, is_checked, deleted_at
    into v_line
  from shopping_list_items
  where id = p_item_id;
  if not found or v_line.deleted_at is not null then
    return;
  end if;

  -- Not ticked: the ordinary reconciler owns this line's number, so any
  -- outstanding line beside it would double-count. Drop it. When this runs
  -- inside the same plan change that updated the line, the two happen together
  -- and the total is never briefly wrong.
  if not v_line.is_checked then
    update shopping_list_items
      set deleted_at = now()
    where outstanding_for = v_line.id
      and deleted_at is null
      and not is_checked;
    return;
  end if;

  -- What the plan needs beyond what the tick covered.
  select coalesce(sum(coalesce(quantity, 0) - coalesce(applied_quantity, 0)), 0)
    into v_outstanding
  from shopping_list_item_contributions
  where item_id = v_line.id;

  -- Anything already bought against a previous outstanding line stays bought,
  -- so it comes off the top. This is what keeps a second plan change from
  -- asking for the same litre twice.
  select coalesce(sum(coalesce(quantity, 0)), 0)
    into v_satisfied
  from shopping_list_items
  where outstanding_for = v_line.id
    and deleted_at is null
    and is_checked;

  v_need := round(greatest(0, v_outstanding - v_satisfied), 2);

  select id, quantity into v_target
  from shopping_list_items
  where outstanding_for = v_line.id
    and deleted_at is null
    and not is_checked
  order by created_at
  limit 1
  for update;

  if v_need = 0 then
    if found then
      update shopping_list_items
        set deleted_at = now()
      where id = v_target.id;
    end if;
    return;
  end if;

  if found then
    -- Only write when the number actually moved, so an unchanged plan change
    -- does not bump updated_at and wake every phone's realtime for nothing.
    if v_target.quantity is distinct from v_need then
      update shopping_list_items
        set quantity = v_need
      where id = v_target.id;
    end if;
  else
    -- Same name, unit and aisle as the line it belongs to, so it files itself
    -- into the same category group rather than landing in Uncategorised.
    insert into shopping_list_items (
      list_id, name, quantity, unit, aisle, added_manually, created_by_user_id,
      outstanding_for
    ) values (
      v_line.list_id, v_line.name, v_need, v_line.unit, v_line.aisle, false,
      auth.uid(), v_line.id
    );
  end if;
end;
$$;

comment on function public.sync_plan_outstanding(uuid) is
  'Recomputes the "still needed" line beside a ticked-off line: '
  'SUM(contribution quantity - applied_quantity), less anything already bought '
  'against it. Idempotent. See migration 0029.';

-- ---------------------------------------------------------------------------
-- contribute_entry_into: 0025's rails restored (a ticked line is left alone),
-- plus a sync so the shopper is told what the new meal still needs.
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
  v_applied numeric;
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
    -- reconcile serialises on it. An outstanding line is excluded as a target:
    -- it is a derived mirror, and a contribution landing on it would be counted
    -- twice – once in its own number and once in the sum that produced it.
    select sli.id, sli.quantity, sli.is_checked, sli.edited_manually
      into v_item
    from shopping_list_items sli
    where sli.list_id = p_list_id
      and sli.deleted_at is null
      and sli.outstanding_for is null
      and public.item_merge_key(sli.name, sli.unit) = v_ing.key
    order by sli.created_at
    limit 1
    for update;

    if found then
      -- 0025: the fold and the record of it are decided ONCE, together, so
      -- withdraw can never reverse an amount that was never added. 0029: a
      -- ticked line is left alone again, as 0025 had it – 0028's un-freezing is
      -- gone, and sync_plan_outstanding is what tells the shopper instead.
      if not v_item.is_checked
         and not v_item.edited_manually
         and v_ing.quantity is not null then
        v_applied := v_ing.quantity;
        update shopping_list_items
          set quantity = round(coalesce(v_item.quantity, 0) + v_ing.quantity, 2)
        where id = v_item.id;
      else
        v_applied := null;
      end if;
      insert into shopping_list_item_contributions
        (item_id, entry_id, quantity, applied_quantity)
      values (v_item.id, p_entry_id, v_ing.quantity, v_applied);
      perform public.sync_plan_outstanding(v_item.id);
    else
      -- A brand-new line is created holding the amount, so it is applied
      -- by construction.
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
      insert into shopping_list_item_contributions
        (item_id, entry_id, quantity, applied_quantity)
      values (v_item_id, p_entry_id, v_ing.quantity, v_ing.quantity);
    end if;

    v_touched := v_touched + 1;
  end loop;

  return v_touched;
end;
$$;

comment on function public.contribute_entry_into(uuid, uuid) is
  'Folds one entry''s scaled ingredients into a week list. A ticked-off line is '
  'left exactly as it is; what the meal still needs shows up on its own line '
  'via sync_plan_outstanding. See migration 0029.';

-- ---------------------------------------------------------------------------
-- rescale_entry: 0025's rails restored, plus a sync per touched line. This is
-- the Tuesday-guests case and the one Thomas's 3x test exercises.
-- ---------------------------------------------------------------------------

create or replace function public.rescale_entry(
  p_entry_id uuid,
  p_old_servings integer,
  p_new_servings integer
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_list_id uuid;
  v_factor numeric;
  v_contribution record;
  v_item record;
  v_old numeric;
  v_new numeric;
  v_next numeric;
  v_found boolean;
begin
  if p_old_servings = p_new_servings or p_old_servings <= 0 then
    return;
  end if;
  v_factor := p_new_servings::numeric / p_old_servings;

  v_list_id := public.entry_week_list(p_entry_id);
  if v_list_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('shopping_list:' || v_list_id::text)::bigint);

  for v_contribution in
    select id, item_id, quantity, applied_quantity
    from shopping_list_item_contributions
    where entry_id = p_entry_id
      and quantity is not null
  loop
    v_old := v_contribution.quantity;
    v_new := round(v_old * v_factor, 2);

    update shopping_list_item_contributions
      set quantity = v_new
    where id = v_contribution.id;

    select id, quantity, is_checked, edited_manually, deleted_at
      into v_item
    from shopping_list_items
    where id = v_contribution.item_id
    for update;
    v_found := found;

    if v_found
       and v_item.deleted_at is null
       and not v_item.is_checked
       and not v_item.edited_manually
       and v_item.quantity is not null
       and v_contribution.applied_quantity is not null then
      -- The line is holding applied_quantity; move it to the new share.
      v_next := round(
        greatest(0, v_item.quantity - v_contribution.applied_quantity + v_new), 2);
      update shopping_list_items
        set quantity = case when v_next = 0 then null else v_next end
      where id = v_item.id;
      update shopping_list_item_contributions
        set applied_quantity = v_new
      where id = v_contribution.id;
    end if;

    -- 0029: a ticked line keeps its number; the difference between what the
    -- plan now needs and what the tick covered becomes its own line. Called
    -- even when nothing above matched, because that is exactly the ticked case.
    if v_found then
      perform public.sync_plan_outstanding(v_item.id);
    end if;
  end loop;
end;
$$;

comment on function public.rescale_entry(uuid, integer, integer) is
  'Servings changed: each contribution scales linearly. A clean line follows. A '
  'ticked-off line is left alone, and the shortfall appears as its own "still '
  'needed" line via sync_plan_outstanding. See migration 0029.';

-- ---------------------------------------------------------------------------
-- withdraw_entry: 0025's function, plus a sync so removing a meal also takes
-- back the "still needed" line it caused.
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_entry(p_entry_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_list_id uuid;
  v_contribution record;
  v_item record;
  v_others_remain boolean;
  v_next numeric;
  v_found boolean;
begin
  v_list_id := public.entry_week_list(p_entry_id);
  if v_list_id is null then
    -- No list to reconcile against; just clear any stray contribution rows.
    delete from shopping_list_item_contributions where entry_id = p_entry_id;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('shopping_list:' || v_list_id::text)::bigint);

  for v_contribution in
    select id, item_id, quantity, applied_quantity
    from shopping_list_item_contributions
    where entry_id = p_entry_id
  loop
    select id, quantity, is_checked, edited_manually, added_manually, deleted_at
      into v_item
    from shopping_list_items
    where id = v_contribution.item_id
    for update;
    v_found := found;

    if v_found then
      v_others_remain := exists (
        select 1 from shopping_list_item_contributions
        where item_id = v_contribution.item_id
          and id <> v_contribution.id
      );

      if v_item.deleted_at is null
         and not v_item.is_checked
         and not v_item.edited_manually then
        if not v_others_remain and not v_item.added_manually then
          -- Pure plan line with nothing else feeding it: it goes.
          update shopping_list_items
            set deleted_at = now()
          where id = v_item.id;
        elsif v_contribution.applied_quantity is not null
              and v_item.quantity is not null then
          v_next := round(greatest(0, v_item.quantity - v_contribution.applied_quantity), 2);
          -- #10: a user-owned line fed only by the plan returns to "no amount".
          update shopping_list_items
            set quantity = case when v_next = 0 then null else v_next end
          where id = v_item.id;
        end if;
      end if;
    end if;

    delete from shopping_list_item_contributions where id = v_contribution.id;

    -- 0029: after the row is gone, so the recompute sees the truth. A meal
    -- removed must also take back whatever "still needed" it had caused.
    if v_found then
      perform public.sync_plan_outstanding(v_item.id);
    end if;
  end loop;
end;
$$;

comment on function public.withdraw_entry(uuid) is
  'Pulls an entry''s share back out of its week list, and recomputes any '
  '"still needed" line so removing a meal takes back what it had asked for. '
  'See migration 0029.';

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run, so the whole file executes. Expect all six columns = true.
-- The prosrc checks matter: a replaced function BODY is invisible to an
-- "exists in pg_proc" test, so that alone would pass on a file that never ran.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shopping_list_items'
      and column_name = 'outstanding_for'
  ) as outstanding_column,
  exists (select 1 from pg_proc where proname = 'sync_plan_outstanding') as sync_fn,
  (select prosrc like '%0029%' from pg_proc where proname = 'contribute_entry_into')
    as contribute_is_0029,
  (select prosrc like '%0029%' from pg_proc where proname = 'rescale_entry')
    as rescale_is_0029,
  (select prosrc like '%0029%' from pg_proc where proname = 'withdraw_entry')
    as withdraw_is_0029,
  (select prosrc not like '%is_checked = case when v_unfreeze%'
     from pg_proc where proname = 'rescale_entry') as unfreezing_gone;
