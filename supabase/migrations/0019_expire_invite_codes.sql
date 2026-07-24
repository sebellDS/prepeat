-- Prep+Eat – invite codes get a lifetime + rotation (security, defence in depth).
--
-- Codes were multi-use (0003, "one fridge code the family shares") and the
-- brute-force sweep was throttled (0012), but a code still worked FOREVER: a
-- leaked, screenshotted or ex-member's code never stopped working. Thomas
-- decided (2026-07-24) codes should expire. Lifetime: 14 days.
--
-- The pieces were half here already: household_invites.expires_at exists and
-- join_household_with_code() already rejects an expired code – nothing ever
-- SET an expiry. This migration adds the one path that mints codes WITH an
-- expiry and, on a manual regenerate, kills the previous live code(s) so a
-- leaked code dies the instant you press "New code" (not 14 days later).
--
-- rotate_invite_code() is the single mint path now: membership-checked, it
-- expires every still-live code for the household, then inserts one fresh
-- 14-day code and returns it. The client's getOrCreateInvite() calls it lazily
-- (missing / expired / legacy null-expiry code -> rotate), which is how old
-- never-expiring codes get replaced with an expiring one; the Invite sheet's
-- "New code" button calls it on demand.

create or replace function public.rotate_invite_code(p_household_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Unambiguous alphabet, mirrors generateCode() in src/lib/household.ts:
  -- no 0/O, 1/I/L or 5/S look-alikes.
  v_alphabet constant text := '2346789ACDEFGHJKMNPQRTUVWXYZ';
  v_expires_at constant timestamptz := now() + interval '14 days';
  v_code text;
  v_i integer;
begin
  if not is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  -- Kill every code that could still be redeemed (future expiry OR the legacy
  -- never-expiring null). After this, the household has no live code but the
  -- one we are about to mint – so a regenerate genuinely retires the old code.
  update household_invites
  set expires_at = now()
  where household_id = p_household_id
    and (expires_at is null or expires_at > now());

  -- Mint a unique 4-char code, retrying on the (rare) unique-code collision.
  loop
    v_code := 'PREP-';
    for v_i in 1..4 loop
      v_code := v_code
        || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into household_invites (household_id, code, created_by, expires_at)
      values (p_household_id, v_code, auth.uid(), v_expires_at);
      exit;
    exception when unique_violation then
      -- Collision – loop and try another code.
    end;
  end loop;

  return json_build_object('code', v_code, 'expires_at', v_expires_at);
end;
$$;

-- One-time backfill: every code minted before today has a null (infinite)
-- expiry. Give each a 14-day life from now so the fix reaches dormant
-- households too – not only the ones that reopen the Invite sheet. The code
-- itself is unchanged; the family just gets a real refresh date, and a
-- long-forgotten leaked code finally lapses.
update household_invites
set expires_at = now() + interval '14 days'
where expires_at is null;

-- Verifying SELECT (lesson from 0008/0010/0012): click once to clear any
-- selection before Run so the whole file executes. Expect true.
select exists (
  select 1 from pg_proc where proname = 'rotate_invite_code'
) as rpc_exists;
