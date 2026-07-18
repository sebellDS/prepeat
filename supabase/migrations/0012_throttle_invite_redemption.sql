-- Prep+Eat – throttle invite redemption to stop code guessing (security fix).
--
-- Invite codes are deliberately short and friendly (PREP-XXXX, 4 chars from a
-- 28-symbol alphabet ≈ 615k combinations) and deliberately multi-use (0003:
-- one fridge-worthy code the whole family shares). That combination is fine for
-- sharing but weak against guessing: join_household_with_code() has no limit,
-- so any signed-in user could script it across the whole code space and land in
-- a stranger's household. The friendly short code stays; we cap how many codes
-- one user can try per hour, which turns a minutes-long sweep into years.
--
-- (Codes still never expire, which is a separate product call – see the
-- backlog. This migration only closes the brute-force hole.)

create table public.invite_redemption_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index invite_redemption_attempts_user_time_idx
  on public.invite_redemption_attempts (user_id, attempted_at);

-- RLS on with no policies: clients get no direct access. Only the SECURITY
-- DEFINER function below (running as the table owner) reads and writes it.
alter table public.invite_redemption_attempts enable row level security;

create or replace function public.join_household_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite household_invites%rowtype;
  v_recent_attempts integer;
begin
  -- Rolling one-hour window: drop this user's stale attempts, then count.
  delete from invite_redemption_attempts
  where user_id = auth.uid()
    and attempted_at < now() - interval '1 hour';

  select count(*) into v_recent_attempts
  from invite_redemption_attempts
  where user_id = auth.uid();

  if v_recent_attempts >= 10 then
    raise exception 'Too many attempts – please wait a little and try again';
  end if;

  insert into invite_redemption_attempts (user_id) values (auth.uid());

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

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run so the whole file executes. Expect both columns = true.
select
  exists (
    select 1 from pg_tables where tablename = 'invite_redemption_attempts'
  ) as attempts_table_exists,
  exists (
    select 1 from pg_proc where proname = 'join_household_with_code'
  ) as rpc_exists;
