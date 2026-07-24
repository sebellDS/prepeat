// Household onboarding operations against the existing schema (migration
// 0001): create-with-bootstrap-membership, invite codes, join via the
// join_household_with_code RPC.
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

export interface Household {
  id: string;
  name: string;
}

/** A household's shareable invite code and when it auto-refreshes (0019). */
export interface Invite {
  code: string;
  /** Epoch ms – the code stops working after this; the sheet shows the date. */
  expiresAt: number;
}

/** One row of the Household screen's member directory (profiles, 0010). */
export interface HouseholdMember {
  userId: string;
  firstName: string | null;
  email: string | null;
  joinedAt: number;
}

interface HouseholdRow {
  id: string;
  name: string;
}

function rowToHousehold(row: HouseholdRow): Household {
  return { id: row.id, name: row.name };
}

/**
 * Every household the signed-in user belongs to, oldest membership first.
 * Powers the multi-household switcher; `fetchMyHousehold` (limit 1) is kept
 * for the onboarding gate where only "is there any household yet" matters.
 */
export async function fetchMyHouseholds(): Promise<Household[]> {
  // Scope to MY memberships: RLS lets a member read every row of a household
  // they belong to (that powers the member directory), so without this filter
  // a 3-member household would come back as three identical rows. Dedupe by
  // household id as a belt-and-braces guard too.
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('household_members')
    .select('households(id, name), joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { households: HouseholdRow | HouseholdRow[] | null }[];
  const seen = new Set<string>();
  const households: Household[] = [];
  for (const row of rows) {
    const h = Array.isArray(row.households) ? (row.households[0] ?? null) : row.households;
    if (h && !seen.has(h.id)) {
      seen.add(h.id);
      households.push(rowToHousehold(h));
    }
  }
  return households;
}

/** The signed-in user's household, or null while onboarding is unfinished. */
export async function fetchMyHousehold(): Promise<Household | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(id, name), joined_at')
    // Oldest membership wins, so a stray duplicate household (e.g. one created
    // during a launch-time network blip) can never shadow the real one.
    .order('joined_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  const row = data?.[0] as
    | { households: HouseholdRow | HouseholdRow[] | null }
    | undefined;
  if (!row?.households) return null;
  const household = Array.isArray(row.households)
    ? (row.households[0] ?? null)
    : row.households;
  return household ? rowToHousehold(household) : null;
}

/**
 * The member directory: memberships plus each member's profile (0010),
 * oldest joiner first – the creator naturally tops the list.
 */
export async function fetchHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  const { data: memberships, error } = await supabase
    .from('household_members')
    .select('user_id, joined_at')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  const rows = memberships ?? [];
  if (rows.length === 0) return [];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, first_name, email')
    .in(
      'user_id',
      rows.map((row) => row.user_id),
    );
  if (profileError) throw profileError;
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return rows.map((row) => ({
    userId: row.user_id,
    firstName: byId.get(row.user_id)?.first_name ?? null,
    email: byId.get(row.user_id)?.email ?? null,
    joinedAt: Date.parse(row.joined_at),
  }));
}

/** Rename the household (any member may, no roles). */
export async function updateHousehold(
  householdId: string,
  changes: { name?: string },
): Promise<void> {
  const patch: { name?: string } = {};
  if (changes.name != null) {
    const trimmed = changes.name.replace(/\s+/g, ' ').trim();
    if (!trimmed) throw new Error('Please give your household a name');
    patch.name = trimmed;
  }
  const { error } = await supabase
    .from('households')
    .update(patch)
    .eq('id', householdId);
  if (error) throw error;
}

/**
 * Creates the household, the creator's own membership (allowed by the
 * bootstrap policy) and a first invite code. Returns both so the "share
 * this code" moment can show immediately.
 */
export async function createHousehold(name: string): Promise<{ household: Household; inviteCode: string }> {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed) throw new Error('Please give your household a name');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user.id;

  const { data: created, error: householdError } = await supabase
    .from('households')
    .insert({ name: trimmed, created_by_user_id: userId })
    .select('id, name')
    .single();
  if (householdError) throw householdError;
  const household = rowToHousehold(created);

  const { error: memberError } = await supabase
    .from('household_members')
    .insert({ user_id: userId, household_id: household.id });
  if (memberError) throw memberError;

  const { code: inviteCode } = await regenerateInvite(household.id);
  return { household, inviteCode };
}

/**
 * The household's shareable invite code (codes are multi-use as of 0003). Shows
 * the newest code while it is still live, otherwise rotates to a fresh one.
 * "Live" now means a code with a FUTURE expiry: a missing code, an expired one,
 * or a legacy never-expiring (null) code all rotate – which is how old
 * infinite-life codes pick up a 14-day expiry the next time the sheet opens.
 */
export async function getOrCreateInvite(householdId: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('household_invites')
    .select('code, expires_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const invite = data?.[0];
  if (invite && invite.expires_at != null && new Date(invite.expires_at) > new Date()) {
    return { code: invite.code, expiresAt: Date.parse(invite.expires_at) };
  }
  return regenerateInvite(householdId);
}

/**
 * Mints a fresh 14-day code and retires any current one (rotate_invite_code,
 * 0019). Used for the first code, lazy auto-rotation, and the sheet's manual
 * "New code" – all one server path, so a leaked code dies the moment a new one
 * is minted rather than lingering to its own expiry.
 */
export async function regenerateInvite(householdId: string): Promise<Invite> {
  const { data, error } = await supabase.rpc('rotate_invite_code', {
    p_household_id: householdId,
  });
  if (error) throw error;
  const row = data as { code: string; expires_at: string };
  return { code: row.code, expiresAt: Date.parse(row.expires_at) };
}

/** Redeems an invite code and returns the joined household. */
export async function joinHousehold(code: string): Promise<Household> {
  const normalized = code.replace(/\s+/g, '').toUpperCase();
  if (!normalized) throw new Error('Please enter an invite code');
  const { data: householdId, error } = await supabase.rpc('join_household_with_code', {
    p_code: normalized,
  });
  if (error) {
    if (/invalid or expired/i.test(error.message)) {
      throw new Error('That code is not valid – check it with the person who sent it');
    }
    if (/too many attempts/i.test(error.message)) {
      throw new Error('Too many tries – wait a few minutes, then try that code again');
    }
    throw error;
  }
  const { data, error: fetchError } = await supabase
    .from('households')
    .select('id, name')
    .eq('id', householdId)
    .single();
  if (fetchError) throw fetchError;
  return rowToHousehold(data);
}

/**
 * Leave a household, taking a personal copy of its recipes (copy-on-leave,
 * docs/leave-household.md). The leave_household RPC (0015) does the atomic DB
 * copy + membership removal and returns the new kitchen plus the photos to
 * carry over; SQL can't move storage files, so we bring each recipe photo into
 * the new household's folder here. We FETCH the original via its public URL
 * (the recipe-photos bucket is public-read, so a just-departed member can
 * still read it) and re-upload – rather than the authenticated storage copy
 * API, which needs read access the leaver no longer has now that listing is
 * scoped to members (0018). Photo failures are non-fatal – the recipe simply
 * keeps no image.
 */
export async function leaveHousehold(householdId: string): Promise<Household> {
  const { data, error } = await supabase.rpc('leave_household', {
    p_household_id: householdId,
  });
  if (error) throw error;
  const result = data as {
    household: HouseholdRow;
    photos: { recipeId: string; sourceUrl: string }[];
  };

  for (const photo of result.photos) {
    try {
      const response = await fetch(photo.sourceUrl);
      if (!response.ok) continue;
      const body = await response.arrayBuffer();
      const dest = `${result.household.id}/${Crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('recipe-photos')
        .upload(dest, body, { contentType: 'image/jpeg' });
      if (uploadError) {
        console.warn('[household] recipe photo copy failed', uploadError);
        continue;
      }
      const publicUrl = supabase.storage.from('recipe-photos').getPublicUrl(dest).data
        .publicUrl;
      await supabase.from('recipes').update({ image_url: publicUrl }).eq('id', photo.recipeId);
    } catch (photoError) {
      console.warn('[household] recipe photo copy failed', photoError);
    }
  }

  return rowToHousehold(result.household);
}

/**
 * Best-effort removal of a household's recipe photos from storage (SQL can't
 * touch storage files, so cascade deletes leave them orphaned). Must run while
 * the caller is still a member of the folder's household – the delete policy
 * is per-household-folder – so call this BEFORE the delete RPC removes the
 * membership. Failures are swallowed: a leftover photo is harmless.
 */
async function deleteHouseholdPhotos(householdId: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from('recipe-photos')
      .list(householdId, { limit: 1000 });
    if (error || !data || data.length === 0) return;
    const { error: removeError } = await supabase.storage
      .from('recipe-photos')
      .remove(data.map((file) => `${householdId}/${file.name}`));
    if (removeError) console.warn('[household] photo folder cleanup failed', removeError);
  } catch (error) {
    console.warn('[household] photo folder cleanup failed', error);
  }
}

/** Ids of households the signed-in user is the sole member of. */
async function soleMemberHouseholdIds(userId: string): Promise<string[]> {
  const { data: mine, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId);
  if (error || !mine || mine.length === 0) return [];
  const ids = mine.map((r) => r.household_id);
  // RLS lets me read every membership of households I belong to, so counting
  // is a single query.
  const { data: all } = await supabase
    .from('household_members')
    .select('household_id')
    .in('household_id', ids);
  const counts = new Map<string, number>();
  for (const r of all ?? []) counts.set(r.household_id, (counts.get(r.household_id) ?? 0) + 1);
  return ids.filter((id) => counts.get(id) === 1);
}

/**
 * GDPR erasure (docs/delete-account.md): delete the caller's account and
 * personal data via the delete_profile RPC (0016). Shared recipes stay with
 * their family with the name cleared; sole-member households are wiped. We
 * clear those households' photos from storage first (the RPC can't). The
 * caller should sign out afterwards – the session token is now orphaned.
 */
export async function deleteProfile(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (userId) {
    const soleIds = await soleMemberHouseholdIds(userId).catch(() => []);
    for (const id of soleIds) await deleteHouseholdPhotos(id);
  }
  const { error } = await supabase.rpc('delete_profile');
  if (error) throw error;
}

/**
 * Delete a household you are the sole member of (0017 `delete_household`).
 * The RPC refuses if the household has other members (use leaveHousehold) or
 * if it is your only household. Cascades away its recipes / plans / lists;
 * we clear its photos from storage first (the RPC can't).
 */
export async function deleteHousehold(householdId: string): Promise<void> {
  await deleteHouseholdPhotos(householdId);
  const { error } = await supabase.rpc('delete_household', { p_household_id: householdId });
  if (error) throw error;
}
