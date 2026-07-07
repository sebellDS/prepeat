// Household onboarding operations against the existing schema (migration
// 0001): create-with-bootstrap-membership, invite codes, join via the
// join_household_with_code RPC.
import { supabase } from '@/lib/supabase';

export interface Household {
  id: string;
  name: string;
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
    .select('household_id, households(id, name)')
    .limit(1);
  if (error) throw error;
  const row = data?.[0] as { households: Household | Household[] | null } | undefined;
  if (!row?.households) return null;
  return Array.isArray(row.households) ? (row.households[0] ?? null) : row.households;
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

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: trimmed, created_by_user_id: userId })
    .select('id, name')
    .single();
  if (householdError) throw householdError;

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
    throw error;
  }
  const { data, error: fetchError } = await supabase
    .from('households')
    .select('id, name')
    .eq('id', householdId)
    .single();
  if (fetchError) throw fetchError;
  return data;
}
