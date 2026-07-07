-- Prep+Eat – invite codes become multi-use.
-- A household wants one fridge-worthy code the whole family can use, not one
-- code per person. Redeeming no longer burns the code: used_at/used_by_user_id
-- now record the most recent use instead of gating reuse. Optional expiry via
-- expires_at still applies.

create or replace function public.join_household_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite household_invites%rowtype;
begin
  select * into v_invite
  from household_invites
  where code = p_code
    and (expires_at is null or expires_at > now())
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into household_members (user_id, household_id)
  values (auth.uid(), v_invite.household_id)
  on conflict do nothing;

  update household_invites
  set used_at = now(),
      used_by_user_id = auth.uid()
  where id = v_invite.id;

  return v_invite.household_id;
end;
$$;
