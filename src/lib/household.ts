// Household onboarding operations against the existing schema (migration
// 0001): create-with-bootstrap-membership, invite codes, join via the
// join_household_with_code RPC.
import { supabase } from '@/lib/supabase';

export interface Household {
  id: string;
  name: string;
  imageUrl: string | null;
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
  image_url: string | null;
}

function rowToHousehold(row: HouseholdRow): Household {
  return { id: row.id, name: row.name, imageUrl: row.image_url };
}

// Unambiguous alphabet: no 0/O, 1/I/L or 5/S look-alikes.
const CODE_ALPHABET = '2346789ACDEFGHJKMNPQRTUVWXYZ';

function generateCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `PREP-${suffix}`;
}

/** The signed-in user's household, or null while onboarding is unfinished. */
export async function fetchMyHousehold(): Promise<Household | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(id, name, image_url), joined_at')
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

/** Rename and/or set the household image (any member may, no roles). */
export async function updateHousehold(
  householdId: string,
  changes: { name?: string; imageUrl?: string },
): Promise<void> {
  const patch: { name?: string; image_url?: string } = {};
  if (changes.name != null) {
    const trimmed = changes.name.replace(/\s+/g, ' ').trim();
    if (!trimmed) throw new Error('Please give your household a name');
    patch.name = trimmed;
  }
  if (changes.imageUrl != null) patch.image_url = changes.imageUrl;
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
    .select('id, name, image_url')
    .single();
  if (householdError) throw householdError;
  const household = rowToHousehold(created);

  const { error: memberError } = await supabase
    .from('household_members')
    .insert({ user_id: userId, household_id: household.id });
  if (memberError) throw memberError;

  const inviteCode = await createInvite(household.id);
  return { household, inviteCode };
}

/**
 * The household's shareable invite code – reuses the newest existing one
 * (codes are multi-use as of migration 0003) or mints the first.
 */
export async function getOrCreateInvite(householdId: string): Promise<string> {
  const { data, error } = await supabase
    .from('household_invites')
    .select('code, expires_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const invite = data?.[0];
  if (invite && (invite.expires_at == null || new Date(invite.expires_at) > new Date())) {
    return invite.code;
  }
  return createInvite(householdId);
}

/** Mints a fresh invite code for the household. */
export async function createInvite(householdId: string): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  // Retry on the unlikely collision with the unique code constraint.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase.from('household_invites').insert({
      household_id: householdId,
      code,
      created_by: userData.user.id,
    });
    if (!error) return code;
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not generate an invite code, please try again');
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
    .select('id, name, image_url')
    .eq('id', householdId)
    .single();
  if (fetchError) throw fetchError;
  return rowToHousehold(data);
}
