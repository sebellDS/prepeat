// Plan → shopping list reconciliation ("A + rails", decided 2026-07-16).
//
// Once a week's plan has been pushed to the shopping list
// (meal_plans.pushed_to_list_at), every plan edit flows into the list
// automatically – but only "clean" lines are touched silently:
//   - clean (unchecked, not hand-edited)  → quantity updates in place
//   - checked                             → left alone; the shopper sees a
//                                           "changed in the plan" marker
//   - hand-edited (edited_manually)       → never overwritten
//
// Merged lines ("Onions" from two meals) track which entries feed them via
// shopping_list_item_contributions, one row per entry per line, so a single
// meal's change rescales only its own share. The marker itself is computed
// where the list renders: is_checked && sum(contributions) ≠ quantity.
//
// The whole reconciler runs server-side as atomic, advisory-locked Postgres
// functions (contribute/push in migration 0013, withdraw/rescale in 0014):
// all-or-nothing per entry, no lost updates or duplicate lines between phones,
// and one round trip per operation. The results reach the other phones through
// the realtime channel on shopping_list_items.
import { supabase } from "@/lib/supabase";

/**
 * One entry flows into its week's list – used when a meal is added to (or
 * swapped on) an already-pushed plan. The server resolves and locks the
 * week's list, merges the entry's scaled ingredients, and skips an entry that
 * is already contributed, so callers can fire it safely. Returns lines touched.
 */
export async function contributeEntry(entryId: string): Promise<number> {
  const { data, error } = await supabase.rpc("contribute_entry", {
    p_entry_id: entryId,
  });
  if (error) throw error;
  return data ?? 0;
}

/**
 * Pulls an entry's share back out of the list (meal removed or swapped).
 * Clean lines shrink – and disappear when nothing else feeds them and they
 * are not user-owned; checked or hand-edited lines keep their value (the
 * marker tells the shopper). A user-owned line fed only by the plan returns
 * to "no amount" rather than 0 (#10). Atomic + locked server-side.
 */
export async function withdrawEntry(entryId: string): Promise<void> {
  const { error } = await supabase.rpc("withdraw_entry", {
    p_entry_id: entryId,
  });
  if (error) throw error;
}

/**
 * Servings changed: contributions scale linearly (scaled = base × s/anchor),
 * so each share becomes share × new/old. Atomic + locked server-side.
 */
export async function rescaleEntry(
  entryId: string,
  oldServings: number,
  newServings: number,
): Promise<void> {
  const { error } = await supabase.rpc("rescale_entry", {
    p_entry_id: entryId,
    p_old_servings: oldServings,
    p_new_servings: newServings,
  });
  if (error) throw error;
}

/**
 * "Add all to shopping list": sweeps every live entry of the plan into its
 * week's list and stamps pushed_to_list_at – from then on plan edits reconcile
 * automatically. Runs as one atomic server call; idempotent (a re-push adds
 * nothing). Returns the number of new list lines.
 */
export async function pushPlanToList(planId: string): Promise<number> {
  const { data, error } = await supabase.rpc("push_plan_to_list", {
    p_plan_id: planId,
  });
  if (error) throw error;
  return data ?? 0;
}
