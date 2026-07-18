-- Prep+Eat – atomic withdraw/rescale + two reconciler bug fixes (review
-- findings #5 and #10). This finishes moving the plan→shopping-list
-- reconciler server-side (contribute/push landed in 0013); withdraw and
-- rescale now run in one transaction under the same per-list advisory lock,
-- so they can no longer partially fail or race a concurrent contribute.
--
-- Fix #10 ("Onions 0"): when the last plan share is pulled out of a
-- user-owned line (a hand-typed item or a recipe hand-off) whose amount came
-- only from the plan, the quantity returns to "no amount" (null) instead of a
-- bare 0. A line with a real base can never reach 0 this way – quantity is
-- base + shares, so subtracting a share leaves at least the base – so 0 means
-- the base was empty, and null is the right display.
--
-- Fix #5 lives in the app (recipes.ts now inserts recipe hand-off lines as
-- added_manually = true, so the reconciler treats them as user-owned and
-- shrinks instead of deleting them); this migration is the withdraw side that
-- then does the right thing with such a line.

-- The entry's week list, if it exists (withdraw/rescale never create one).
create or replace function public.entry_week_list(p_entry_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select l.id
  from meal_plan_entries e
  join meal_plans p on p.id = e.meal_plan_id
  join shopping_lists l
    on l.household_id = p.household_id
   and l.week_start_date = p.week_start_date
   and l.deleted_at is null
  where e.id = p_entry_id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- withdraw_entry: pull an entry's share back out (meal removed or swapped).
-- Clean lines shrink – and disappear when nothing else feeds them and they
-- are not user-owned; checked or hand-edited lines keep their value (the
-- marker tells the shopper).
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
    select id, item_id, quantity
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
        elsif v_contribution.quantity is not null and v_item.quantity is not null then
          v_next := round(greatest(0, v_item.quantity - v_contribution.quantity), 2);
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
-- Faithful port of the old client logic, now atomic and locked.
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
    select id, item_id, quantity
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
       and v_item.quantity is not null then
      v_next := round(greatest(0, v_item.quantity - v_old + v_new), 2);
      update shopping_list_items
        set quantity = case when v_next = 0 then null else v_next end
      where id = v_item.id;
    end if;
  end loop;
end;
$$;

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run so the whole file executes. Expect all three columns = true.
select
  exists (select 1 from pg_proc where proname = 'entry_week_list') as entry_list_fn,
  exists (select 1 from pg_proc where proname = 'withdraw_entry') as withdraw_fn,
  exists (select 1 from pg_proc where proname = 'rescale_entry') as rescale_fn;
