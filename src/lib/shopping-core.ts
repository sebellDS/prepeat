// Leaf helpers shared by the shopping list, the recipes hand-off and the
// plan→shopping reconciler (extracted 2026-07-16 so plan-shopping.ts and
// shopping-list.tsx can depend on the same pieces without an import cycle).
import { supabase } from '@/lib/supabase';

// v1 category set (projektgrundlag decision #7): fixed constants in app code.
// Order here is the default display order until the household reorders.
export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Fish',
  'Bakery',
  'Frozen',
  'Pantry',
  'Drinks',
  'Household',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export function normalizeItemName(name: string): string {
  // Same rule as ingredient merging: trimmed, lowercased. Also collapse
  // whitespace (incl. non-breaking spaces) so near-identical entries match.
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * What a move of a past week's leftovers did, as the server reports it.
 * Opaque to the app apart from `moved` – it goes straight back to
 * undoMoveWeekLeftovers, which is the only thing that reads `lines`.
 */
export interface MoveReceipt {
  from_list_id: string;
  to_list_id: string;
  moved: number;
  lines: unknown[];
}

/**
 * "Move all items to this week": every unchecked item leaves the past week's
 * list and lands on the current week's, merging into a line already there
 * rather than doubling it. One atomic, advisory-locked server call (migration
 * 0026) – the two lists must not be able to disagree half way through.
 * `toWeek` is the app's own local-time Monday, so the server never has to
 * guess which week the phone means.
 */
export async function moveWeekLeftovers(
  fromListId: string,
  toWeek: string,
): Promise<MoveReceipt> {
  const { data, error } = await supabase.rpc('move_week_leftovers', {
    p_from_list_id: fromListId,
    p_to_week: toWeek,
  });
  if (error) throw error;
  return data as MoveReceipt;
}

/** Puts a move back exactly as it was, from the receipt (the undo toast). */
export async function undoMoveWeekLeftovers(receipt: MoveReceipt): Promise<void> {
  const { error } = await supabase.rpc('undo_move_week_leftovers', {
    p_receipt: receipt,
  });
  if (error) throw error;
}

// Exported for the recipes flow and the plan reconciler. Lists are per week
// since migration 0008 (one per household per week_start_date).
export async function getOrCreateListId(
  householdId: string,
  userId: string,
  weekStart: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('household_id', householdId)
    .eq('week_start_date', weekStart)
    .is('deleted_at', null)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return data[0].id;

  const { data: created, error: insertError } = await supabase
    .from('shopping_lists')
    .insert({
      household_id: householdId,
      created_by_user_id: userId,
      week_start_date: weekStart,
    })
    .select('id')
    .single();
  if (!insertError) return created.id;
  // Unique index: another phone created this week's list first – use theirs.
  if (insertError.code === '23505') {
    const { data: existing, error: retryError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId)
      .eq('week_start_date', weekStart)
      .is('deleted_at', null)
      .limit(1);
    if (retryError) throw retryError;
    if (existing?.[0]) return existing[0].id;
    // Conflict but no row for this week: the database still has the old
    // one-list-per-household rule – migration 0008 has not (fully) run.
    throw new Error(
      `shopping list conflict for week ${weekStart} but no row found – is migration 0008 applied?`,
    );
  }
  throw insertError;
}
