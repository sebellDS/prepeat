-- 0028: a plan change that needs MORE than you ticked off comes back onto the
-- list, instead of vanishing.
--
-- THE GAP (Thomas, 2026-08-04, from his own week)
--   Sunday   plan the week
--   Monday   go through the list, check what is already in the kitchen, tick
--            those off, then shop for the rest
--   Tuesday  guests coming, so bump Wednesday's recipe from 4 to 8 servings
-- Nothing happened. rescale_entry doubled every recorded contribution – the
-- database knew perfectly well that 400 g of mince had become 800 g – but it
-- only ever touched a line that was `not is_checked`, and Monday had checked
-- them all. No new line, no changed amount, and the "changed in the plan"
-- marker that 0013/0014/0025 all promise in their comments was never built in
-- the app. So the app knew he would be short for a dinner with guests and
-- showed him nothing.
--
-- WHY "YOU PROBABLY BOUGHT A WHOLE PACK ANYWAY" DOES NOT RESCUE IT
-- That holds for a rounding difference. A serving bump is a FACTOR: every
-- ingredient in the meal rises at once. 400 g becomes 800 g, one pack becomes
-- two. The shortfall is proportional and real.
--
-- WHAT A TICK ACTUALLY MEANS, which is the whole basis of the rule below
-- (Thomas, correcting an earlier draft of this migration): the tick is not
-- "I bought this". The real flow is that recipes put things on the list, then
-- the human walks the kitchen and ticks off what they already have, and only
-- then goes shopping. So a tick is a JUDGEMENT – "I have enough for what this
-- line says" – and it was made against a specific amount.
-- When the plan raises that amount, the judgement is stale. Whether the
-- cupboard still covers the new number is something only the person who looked
-- in it can say. So the honest move is to hand it back to them: put the line
-- on the list with the new amount, and let them re-tick if they are still fine.
--
-- THE RULE
-- A checked line stops being frozen when the plan raises it: the new amount is
-- folded in and the line is UN-CHECKED, so it returns to the active list.
-- Un-checking IS the signal, which is why this needs no new UI and reaches
-- every phone the moment it runs rather than waiting for a build.
--
-- IT APPLIES TO EVERY ITEM, WITH NO EXCEPTIONS BY KIND. An earlier draft
-- carved out seasoning-scale units (tsp, tbsp, pinch…) so that salt and pepper
-- would not keep coming back. Thomas rejected it, and he is right: it hardcodes
-- an assumption about what a household stocks – *"what if people don't have
-- salt and pepper?"* – and the app cannot know that for a spice any more than
-- for mince. A unit list would be the app guessing on the household's behalf,
-- and guessing quietly. The uniform rule assumes nothing.
-- The churn this costs is small and comprehensible: it happens only when
-- someone CHANGES a meal, which is a deliberate act they just performed, and
-- re-ticking a line they still have enough of is one tap.
-- The proper way to make the app quieter about staples is for the household to
-- TELL it – a learned per-household "I always have this", the same
-- teach-it-once shape as item_category_memory (decision #7). That is logged in
-- the backlog next to Teach-a-synonym. Learned, never guessed.
--
-- WHAT STILL NEVER MOVES, and neither is a guess about anyone's kitchen:
--   * A HAND-EDITED line (edited_manually). You typed that amount; the rails
--     from 0013 exist to protect exactly that, and nothing here weakens it.
--   * A DECREASE. Fewer servings means the judgement "I have enough" is still
--     true – it was true at a higher number. There is nothing to buy and
--     nothing to re-decide, so a tick is not worth disturbing.
--
-- SCOPE: both directions a plan can ask for more.
--   contribute_entry_into – a new meal merging into a checked line (the first
--     thing Thomas reported: "it does not update shopping list when adding a
--     meal to plan").
--   rescale_entry – servings changed on a meal already on the list (the
--     Tuesday-guests case above).
-- withdraw_entry is deliberately untouched: it reverses applied_quantity, and
-- since an un-frozen line records what was applied, a later withdraw already
-- reverses exactly the right amount. 0025's invariant is preserved – a line's
-- quantity is the sum of its live contributions' applied_quantity plus whatever
-- the user owns.
--
-- SAFE FOR THE PHONES (the 0022 lesson): two function bodies replaced, nothing
-- added, nothing dropped, no signature changed – so TestFlight builds 12, 13
-- and 14 keep working. It needs NO app change either: an un-checked row is an
-- ordinary UPDATE and travels on the realtime channel the list already
-- watches, so the row simply moves from the done band back into the list.
-- Note this DOES change behaviour for everyone the moment it runs, including
-- the build 12 that v1.0 is bound to. That is intended, and it is a behaviour
-- change rather than a compatibility one: no client is reading a column or
-- calling a function whose shape moved.

-- ---------------------------------------------------------------------------
-- contribute_entry_into: 0025's function, plus un-freezing a checked line when
-- an incoming amount raises it.
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
  v_unfreeze boolean;
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
      -- 0028: a checked line takes the amount and comes back onto the list, so
      -- the person who judged "I have enough" can judge the new number. Any
      -- incoming amount raises the total, so there is nothing to compare here –
      -- unlike rescale, which can also go down.
      v_unfreeze := v_item.is_checked
                    and not v_item.edited_manually
                    and v_ing.quantity is not null;
      -- 0025: the fold and the record of it are decided ONCE, together, so
      -- withdraw can never reverse an amount that was never added.
      if (not v_item.is_checked or v_unfreeze)
         and not v_item.edited_manually
         and v_ing.quantity is not null then
        v_applied := v_ing.quantity;
        update shopping_list_items
          set quantity = round(coalesce(v_item.quantity, 0) + v_ing.quantity, 2),
              is_checked = case when v_unfreeze then false else is_checked end,
              checked_by_initial =
                case when v_unfreeze then null else checked_by_initial end,
              checked_by_user_id =
                case when v_unfreeze then null else checked_by_user_id end,
              checked_at = case when v_unfreeze then null else checked_at end
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
-- rescale_entry: 0025's function, plus un-freezing a checked line when the
-- entry's share GOES UP. This is the Tuesday-guests case.
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
  v_unfreeze boolean;
  -- FOUND is captured the instant the SELECT INTO returns, because this
  -- version puts an assignment between that select and the test below.
  -- Assignments are not supposed to disturb FOUND, but a rail this
  -- load-bearing should not rest on that.
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

    -- 0028: a checked line joins in when its share GOES UP – and only then.
    -- A decrease leaves it alone: "I have enough" was judged at a HIGHER
    -- number, so it is still true and there is nothing to re-decide.
    v_unfreeze := v_found
                  and v_item.deleted_at is null
                  and v_item.is_checked
                  and not v_item.edited_manually
                  and v_contribution.applied_quantity is not null
                  and v_new > v_contribution.applied_quantity;

    if v_found
       and v_item.deleted_at is null
       and (not v_item.is_checked or v_unfreeze)
       and not v_item.edited_manually
       and v_item.quantity is not null
       and v_contribution.applied_quantity is not null then
      -- The line is holding applied_quantity; move it to the new share.
      v_next := round(
        greatest(0, v_item.quantity - v_contribution.applied_quantity + v_new), 2);
      update shopping_list_items
        set quantity = case when v_next = 0 then null else v_next end,
            is_checked = case when v_unfreeze then false else is_checked end,
            checked_by_initial =
              case when v_unfreeze then null else checked_by_initial end,
            checked_by_user_id =
              case when v_unfreeze then null else checked_by_user_id end,
            checked_at = case when v_unfreeze then null else checked_at end
      where id = v_item.id;
      update shopping_list_item_contributions
        set applied_quantity = v_new
      where id = v_contribution.id;
    end if;
  end loop;
end;
$$;

comment on function public.rescale_entry(uuid, integer, integer) is
  'Servings changed: each contribution scales linearly. A clean line follows. '
  'A CHECKED line follows too when its share goes UP, and is un-checked so the '
  'person who judged "I have enough" can judge the new amount. A decrease, and '
  'a hand-edited line, are left alone. See migration 0028.';

comment on function public.contribute_entry_into(uuid, uuid) is
  'Folds one entry''s scaled ingredients into a week list. A CHECKED line now '
  'takes the amount and is un-checked rather than silently frozen; a '
  'hand-edited line is still never touched. See migration 0028.';

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run, so the whole file executes. Expect all four columns = true.
-- The last two prove the rule reached the function bodies, since a replaced
-- body is otherwise invisible to a catalogue query.
select
  exists (select 1 from pg_proc where proname = 'contribute_entry_into') as contribute_fn,
  exists (select 1 from pg_proc where proname = 'rescale_entry') as rescale_fn,
  (select prosrc like '%0028%' from pg_proc where proname = 'contribute_entry_into')
    as contribute_is_0028,
  (select prosrc like '%0028%' from pg_proc where proname = 'rescale_entry')
    as rescale_is_0028;
