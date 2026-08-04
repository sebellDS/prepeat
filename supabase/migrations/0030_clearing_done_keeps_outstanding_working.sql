-- 0030: "Clear done items" no longer switches off the "still needed" line.
--
-- THE BUG (Thomas, 2026-08-04, testing 0029 within the hour)
-- *"if I clear all marked item in shopping, the logic collapses and nothing is
-- shown if I change servings."*
-- Exactly right, and it is one line of 0029's sync function. Clearing the done
-- band soft-deletes those rows (deleted_at = now(), is_checked left true), and
-- sync_plan_outstanding opened with:
--     if not found or v_line.deleted_at is not null then return; end if;
-- So once the milk was cleared away, every later plan change found a deleted
-- line and bailed out before computing anything. The 4th litre stayed invisible
-- – the same silence the whole 0028/0029 line of work exists to remove, reached
-- by a different door.
--
-- WHY THE GUARD WAS WRONG
-- It read "deleted" as "no longer relevant". But CLEARING IS THE STRONGEST FORM
-- OF SATISFIED: the shopper ticked the line off and then swept it off the list
-- because it was handled. The requirement it was covering did not go anywhere,
-- so when the plan later asks for more, the difference is still owed. A cleared
-- line is the best possible record of "I had these".
--
-- THE TWO CHANGES, both about the same confusion between "gone" and "settled":
--   1. Do not bail when the mirrored line is soft-deleted. Bail only when the
--      row does not exist at all, or when it is NOT TICKED – live-and-unticked
--      means the ordinary reconciler owns its number, and deleted-while-unticked
--      means the shopper threw it away deliberately.
--   2. Count a ticked outstanding line as satisfied whether or not it was later
--      cleared. Without this, clearing the done band a second time would make an
--      already-bought extra litre come back: the satisfied sum would drop to
--      zero and the shortfall would be asked for twice.
--
-- Walked in simulation before writing, since none of it is reachable without
-- three or four steps of setup:
--   tick 3 l, clear done, double one of three meals -> "1 l still needed"
--   un-double it                                    -> the line removes itself
--   tick the extra litre off, clear done again,
--     then double a SECOND meal                     -> asks for 1 more, not 2
--
-- SAFE FOR THE PHONES (the 0022 lesson): one function body replaced. Nothing
-- added, nothing dropped, no signature changed, no app change – builds 12, 13
-- and 14 keep working and pick this up the moment it runs.

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
  -- FOUND is captured straight off the select it belongs to, rather than read
  -- several statements later. Same rail as rescale_entry in 0028.
  v_has_target boolean;
begin
  select id, list_id, name, unit, aisle, quantity, is_checked, deleted_at
    into v_line
  from shopping_list_items
  where id = p_item_id;
  if not found then
    return;
  end if;

  -- 0030: deliberately NOT testing deleted_at here. A line that was ticked and
  -- then cleared off the list is the strongest record of "I had these", so what
  -- the plan needs beyond it is still owed and still has to be shown.
  if not v_line.is_checked then
    -- Live and unticked: the ordinary reconciler owns this line's number, so an
    -- outstanding line beside it would double-count. Deleted and unticked: the
    -- shopper threw it away on purpose. Either way, no outstanding line.
    -- HARD delete, not a tombstone – see the note on the other delete below.
    delete from shopping_list_items
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

  -- Anything already settled against a previous outstanding line stays settled.
  -- The partition is: an outstanding line is either LIVE AND UNTICKED, in which
  -- case it is the amount still being asked for, or it is anything else – ticked,
  -- cleared, or deleted by the shopper – in which case it is settled and comes
  -- off the top. Both non-live cases were found by walking the state grid rather
  -- than by imagining a scenario:
  --   * ticked then CLEARED: without this, clearing the done band a second time
  --     would ask for an already-bought litre all over again.
  --   * SWIPE-DELETED while unticked: deleting is the shopper saying "I do not
  --     need this". Counting it as settled means it stays gone, while a LATER,
  --     BIGGER need still shows up – asking only for the increment above what
  --     they dismissed. Recreating it unchanged, which is what an is_checked-only
  --     test did, reads as the app refusing to let go of a line.
  select coalesce(sum(coalesce(quantity, 0)), 0)
    into v_satisfied
  from shopping_list_items
  where outstanding_for = v_line.id
    and (is_checked or deleted_at is not null);

  v_need := round(greatest(0, v_outstanding - v_satisfied), 2);

  select id, quantity, edited_manually into v_target
  from shopping_list_items
  where outstanding_for = v_line.id
    and deleted_at is null
    and not is_checked
  order by created_at
  limit 1
  for update;
  v_has_target := found;

  -- A hand-edited outstanding line is the shopper's number, not ours. Every
  -- other rail in this system treats edited_manually as untouchable and this one
  -- did not, which the state grid caught: it would have overwritten a typed
  -- amount on the next plan change. Leave it entirely alone – do not overwrite
  -- it and do not create a second line beside it either.
  if v_has_target and v_target.edited_manually then
    return;
  end if;

  if v_need = 0 then
    if v_has_target then
      -- HARD delete, and this matters for correctness rather than tidiness.
      -- A tombstone here would be indistinguishable from a line the SHOPPER
      -- deleted, and the settled sum above counts those – so sync's own
      -- housekeeping would be read back as "already bought". Un-double a meal
      -- and re-double it, and the second change would show nothing at all.
      -- The check script caught exactly that. These rows are derived and hold
      -- no user data, so there is nothing to tombstone: no contribution can
      -- reference one (they are excluded as merge targets), and the app already
      -- handles a real DELETE event.
      delete from shopping_list_items
      where id = v_target.id;
    end if;
    return;
  end if;

  if v_has_target then
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
  'against it. Works whether that line is still on the list or was cleared '
  'away, because clearing means satisfied. Idempotent. See migrations '
  '0029 and 0030.';

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run, so the whole file executes. Expect all three columns = true.
-- The second and third read the live body, because "the function exists" would
-- have been true before this file ran too.
select
  exists (select 1 from pg_proc where proname = 'sync_plan_outstanding') as sync_fn,
  (select prosrc like '%0030%' from pg_proc where proname = 'sync_plan_outstanding')
    as sync_is_0030,
  (select prosrc not like '%if not found or v_line.deleted_at is not null%'
     from pg_proc where proname = 'sync_plan_outstanding') as bail_on_cleared_gone;
