-- 0025: stop a shopping-list quantity drifting wrong when a line is checked
-- or unchecked around a plan change. Found 2026-08-02 by the pre-build audit
-- (finding 2), in the feature the App Store listing calls the centrepiece:
-- "the list builds itself from the plan".
--
-- WHAT WAS WRONG – contribute and withdraw were not symmetric.
-- contribute_entry_into (0013) ALWAYS records a contribution row, but only
-- folds its amount into the visible line when the line is unchecked and not
-- hand-edited:
--     insert into shopping_list_item_contributions ...        -- always
--     if not is_checked and not edited_manually ... then
--       update shopping_list_items set quantity = quantity + ...  -- sometimes
-- withdraw_entry (0014) then subtracts that recorded amount based on the
-- line's state AT WITHDRAW TIME. rescale_entry has the same shape.
--
-- A shopper checks and unchecks lines while shopping, so the two sides
-- disagree. Concretely, with "2 onions" on the list:
--   1. shopper checks the onion line off in the shop
--   2. someone adds another onion meal to the week -> a contribution of 2 is
--      RECORDED, but not added (the line is checked), so it still reads 2
--   3. shopper unchecks the line (picked the wrong one, put it back)
--   4. that meal is swapped out -> withdraw subtracts 2, and the line drops
--      to "no amount" even though the first meal still needs 2 onions
-- The line was never credited the 2, but it gets debited the 2.
--
-- THE FIX – record what was ACTUALLY applied, and reverse only that.
-- A new column, applied_quantity, holds the amount folded into the visible
-- line (null = nothing was). withdraw and rescale work from it instead of
-- from the line's live checked/edited state, so a debit can never exceed the
-- credit that was made. The invariant this restores: a line's quantity is the
-- sum of the applied_quantity of its live contributions, plus whatever the
-- user owns.
--
-- Why a separate column and not "recompute the line from its contributions
-- on every change": checked, hand-edited and manually-added lines are
-- deliberately frozen (0013's rails, decision #8), and a full recompute would
-- overwrite the amounts a user owns. This keeps every existing intent and
-- only stops the over-subtraction.
--
-- EXISTING ROWS are backfilled applied_quantity = quantity, which is exactly
-- today's behaviour – so this migration changes nothing for a list that has
-- not hit the bug, and cannot itself move any number. History before today
-- cannot be reconstructed (nothing recorded whether a fold happened), and it
-- self-corrects as entries are withdrawn and re-added.

alter table public.shopping_list_item_contributions
  add column if not exists applied_quantity numeric;

update public.shopping_list_item_contributions
  set applied_quantity = quantity
  where applied_quantity is null;

comment on column public.shopping_list_item_contributions.applied_quantity is
  'The amount actually folded into the visible line''s quantity (null = none, '
  'because the line was checked, hand-edited, or the amount was unparseable). '
  'withdraw_entry and rescale_entry reverse THIS, never the raw quantity – see '
  'migration 0025.';

-- ---------------------------------------------------------------------------
-- contribute_entry_into: unchanged except that it now records what it applied.
-- Faithful re-creation of 0013's function with applied_quantity added.
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
      -- 0025: the fold and the record of it are decided ONCE, together, so
      -- withdraw can never reverse an amount that was never added.
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

-- ---------------------------------------------------------------------------
-- withdraw_entry: pull an entry's share back out (meal removed or swapped).
-- Clean lines shrink – and disappear when nothing else feeds them and they
-- are not user-owned; checked or hand-edited lines keep their value (the
-- marker tells the shopper).
--
-- 0025: the amount subtracted is applied_quantity, not quantity. The
-- DELETE branch is deliberately unchanged – whether a line should still
-- EXIST is about what feeds it, not about how its number was reached.
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

    if found then
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
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- rescale_entry: servings changed – each contribution scales linearly
-- (share × new/old) and the clean line's quantity moves by the difference.
--
-- 0025: the line moves by (new applied − old applied), and applied_quantity
-- follows only when the line actually moved. A contribution that was never
-- folded in (line checked at the time) rescales its own recorded share while
-- leaving the line alone and applied_quantity null – so a later withdraw
-- still has nothing to reverse. A contribution that WAS folded in but whose
-- line is now checked keeps its old applied_quantity, because that is what
-- the line is still holding.
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

    if found
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
  end loop;
end;
$$;

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run so the whole file executes. Expect all four columns = true.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shopping_list_item_contributions'
      and column_name = 'applied_quantity'
  ) as applied_column,
  not exists (
    select 1 from public.shopping_list_item_contributions
    where quantity is not null and applied_quantity is null
      and created_at < now() - interval '1 minute'
  ) as backfilled,
  exists (select 1 from pg_proc where proname = 'withdraw_entry') as withdraw_fn,
  exists (select 1 from pg_proc where proname = 'rescale_entry') as rescale_fn;
