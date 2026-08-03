-- Prep+Eat – move a past week's leftovers onto the current week's list
-- (Thomas, 2026-08-03; designed in Figma 434:7148 "transfer items from last
-- week").
--
-- WHAT IT IS: at the end of a week the list still holds whatever was not
-- bought – out of stock, forgotten, not needed yet. Standing on that past
-- week, one button ("Move all items to this week") sends its unchecked items
-- forward: they leave the old week and appear on the current one.
--
-- WHY IT IS A SERVER FUNCTION and not a handful of REST writes, the same
-- reasoning as 0013: it touches two lists at once, merges into lines other
-- phones may be editing, and must be all-or-nothing. One transaction, both
-- lists advisory-locked, one round trip.
--
-- THE ONE REAL SUBTLETY – an item cannot simply have its list_id repointed.
-- A plan-fed line carries shopping_list_item_contributions rows tied to the
-- OLD week's meal entries, and those entries stay where they are. Repointing
-- would drag the old week's plan bookkeeping onto the new week, where
-- withdraw_entry would later subtract amounts from a list the meal was never
-- on. So a moved item lands as a fresh, user-owned row (added_manually =
-- true, no contributions) and the old row is soft-deleted. It stops being
-- "the plan's" item and becomes "yours" – which is also what it means in
-- real life: you are the reason it is still on the list.
--
-- IT MERGES, IT DOES NOT DUPLICATE. The new week may already plan the same
-- ingredient, so the move goes through item_merge_key exactly the way
-- contribute_entry_into does. Carrying two leftover onions onto a week that
-- already plans three gives one line of five, not two lines.
--
-- WHICH LINE IT MERGES INTO – the oldest live UNCHECKED line with the same
-- key. Deliberately narrower than contribute_entry_into, which merges into
-- the oldest live line whether checked or not: folding a leftover into a line
-- somebody already ticked off this week would make the moved item arrive
-- pre-bought and invisible, when the whole point is that it still needs
-- buying. If every match is checked, the move creates its own line.
--
-- IT DOES FOLD INTO A HAND-EDITED LINE, which the plan reconciler refuses to
-- do. Those rails (0013, decision #8) exist so an AUTOMATIC reconciliation
-- never overwrites a number the family set by hand. This is not automatic –
-- somebody just tapped a button asking for exactly this – and folding adds to
-- their number rather than replacing it. The line is left un-flagged so the
-- plan can still reconcile it; withdraw_entry only ever subtracts
-- applied_quantity (0025), so the carried amount survives.

-- ---------------------------------------------------------------------------
-- move_week_leftovers: every unchecked item on p_from_list_id moves to the
-- household's p_to_week list. Returns a RECEIPT – enough to reverse the move
-- exactly, which is what the undo toast needs (see undo_move_week_leftovers).
--
-- p_to_week is passed in rather than computed from now(): the app decides
-- which Monday "this week" is, in LOCAL time (weekStartOf in src/lib/week.ts),
-- and date_trunc('week', now()) would disagree with it for the hours either
-- side of midnight Sunday.
--
-- SECURITY INVOKER (the default), like 0013/0014: every table it touches is
-- household-scoped and already covered by the caller's RLS, so a non-member
-- simply finds no list and moves nothing.
-- ---------------------------------------------------------------------------

create or replace function public.move_week_leftovers(
  p_from_list_id uuid,
  p_to_week date
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_household_id uuid;
  v_from_week date;
  v_to_list_id uuid;
  v_item record;
  v_target record;
  v_key text;
  v_to_item_id uuid;
  v_applied numeric;
  v_created boolean;
  v_lines jsonb := '[]'::jsonb;
  v_moved integer := 0;
  v_empty constant jsonb := jsonb_build_object('moved', 0, 'lines', '[]'::jsonb);
begin
  select household_id, week_start_date
    into v_household_id, v_from_week
  from shopping_lists
  where id = p_from_list_id
    and deleted_at is null;
  if not found then
    return v_empty;
  end if;

  -- Forwards only, and never onto itself. The button is only drawn on past
  -- weeks, so this is a backstop against a stale screen (the app was left
  -- open across midnight on Sunday and "last week" has since become this one).
  if p_to_week is null or p_to_week <= v_from_week then
    return v_empty;
  end if;

  v_to_list_id := public.resolve_week_list(v_household_id, p_to_week);

  -- Both lists are locked, always lowest id first, so two phones moving in
  -- opposite directions cannot deadlock each other.
  perform pg_advisory_xact_lock(
    hashtext('shopping_list:' || least(p_from_list_id, v_to_list_id)::text)::bigint);
  perform pg_advisory_xact_lock(
    hashtext('shopping_list:' || greatest(p_from_list_id, v_to_list_id)::text)::bigint);

  for v_item in
    select id, name, quantity, unit, aisle
    from shopping_list_items
    where list_id = p_from_list_id
      and deleted_at is null
      and not is_checked
    order by created_at
    for update
  loop
    v_key := public.item_merge_key(v_item.name, v_item.unit);

    select sli.id, sli.quantity
      into v_target
    from shopping_list_items sli
    where sli.list_id = v_to_list_id
      and sli.deleted_at is null
      and not sli.is_checked
      and public.item_merge_key(sli.name, sli.unit) = v_key
    order by sli.created_at
    limit 1
    for update;

    if found then
      v_created := false;
      v_to_item_id := v_target.id;
      -- An item with no amount ("Tape") contributes presence, not a number –
      -- there is nothing to add and nothing for undo to take back.
      if v_item.quantity is null then
        v_applied := null;
      else
        v_applied := v_item.quantity;
        update shopping_list_items
          set quantity = round(coalesce(v_target.quantity, 0) + v_item.quantity, 2)
        where id = v_target.id;
      end if;
    else
      v_created := true;
      v_to_item_id := gen_random_uuid();
      -- The amount arrives with the new line, so it is applied by
      -- construction – undo deletes the whole line rather than unpicking it.
      v_applied := v_item.quantity;
      insert into shopping_list_items (
        id, list_id, name, quantity, unit, aisle, added_manually, created_by_user_id
      ) values (
        v_to_item_id, v_to_list_id, v_item.name, v_item.quantity, v_item.unit,
        v_item.aisle, true, auth.uid()
      );
    end if;

    -- Soft delete, per projektgrundlag – and the realtime echo of this is what
    -- takes the row off the other phones looking at the old week.
    update shopping_list_items
      set deleted_at = now()
    where id = v_item.id;

    v_lines := v_lines || jsonb_build_object(
      'from_item_id', v_item.id,
      'to_item_id', v_to_item_id,
      'created', v_created,
      'applied', v_applied
    );
    v_moved := v_moved + 1;
  end loop;

  return jsonb_build_object(
    'from_list_id', p_from_list_id,
    'to_list_id', v_to_list_id,
    'moved', v_moved,
    'lines', v_lines
  );
end;
$$;

comment on function public.move_week_leftovers(uuid, date) is
  'Moves every unchecked item off a past week''s shopping list onto the given '
  'week''s list, merging by item_merge_key. Returns a receipt for '
  'undo_move_week_leftovers. See migration 0026.';

-- ---------------------------------------------------------------------------
-- undo_move_week_leftovers: put it all back, from the receipt.
--
-- The move is the most destructive action on a past week's list – it empties
-- it – and it is offered with no confirmation dialog (Thomas, 2026-08-03), so
-- undo has to be exact rather than approximate. The receipt records, per item,
-- whether the target line was CREATED by the move (undo deletes it) or merely
-- grew (undo subtracts exactly what was added, never more – the same lesson
-- as 0025's applied_quantity).
--
-- A line that was hand-edited, checked or deleted by somebody else during the
-- undo window is left as they left it: every reversal is guarded on
-- deleted_at, and a subtraction that would take a line to zero or below
-- returns it to "no amount" rather than a literal 0 (#10, matching
-- withdraw_entry).
-- ---------------------------------------------------------------------------

create or replace function public.undo_move_week_leftovers(p_receipt jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_from_list_id uuid;
  v_to_list_id uuid;
  v_line jsonb;
  v_applied numeric;
  v_restored integer := 0;
begin
  v_from_list_id := (p_receipt ->> 'from_list_id')::uuid;
  v_to_list_id := (p_receipt ->> 'to_list_id')::uuid;
  if v_from_list_id is null or v_to_list_id is null then
    return 0;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('shopping_list:' || least(v_from_list_id, v_to_list_id)::text)::bigint);
  perform pg_advisory_xact_lock(
    hashtext('shopping_list:' || greatest(v_from_list_id, v_to_list_id)::text)::bigint);

  for v_line in
    select value from jsonb_array_elements(coalesce(p_receipt -> 'lines', '[]'::jsonb))
  loop
    if coalesce((v_line ->> 'created')::boolean, false) then
      update shopping_list_items
        set deleted_at = now()
      where id = (v_line ->> 'to_item_id')::uuid
        and deleted_at is null;
    else
      v_applied := (v_line ->> 'applied')::numeric;
      if v_applied is not null then
        update shopping_list_items
          set quantity = case
                when round(coalesce(quantity, 0) - v_applied, 2) > 0
                  then round(coalesce(quantity, 0) - v_applied, 2)
                else null
              end
        where id = (v_line ->> 'to_item_id')::uuid
          and deleted_at is null;
      end if;
    end if;

    -- Clearing deleted_at revives the old week's row; the set_updated_at
    -- trigger bumps updated_at, so the other phones see it come back too.
    update shopping_list_items
      set deleted_at = null
    where id = (v_line ->> 'from_item_id')::uuid;

    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$$;

comment on function public.undo_move_week_leftovers(jsonb) is
  'Reverses move_week_leftovers from its receipt: created lines are deleted, '
  'merged lines give back exactly what was added, and the old week''s rows are '
  'un-deleted. See migration 0026.';

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run, so the whole file executes. Expect both columns = true.
select
  exists (select 1 from pg_proc where proname = 'move_week_leftovers') as move_fn,
  exists (select 1 from pg_proc where proname = 'undo_move_week_leftovers') as undo_fn;
