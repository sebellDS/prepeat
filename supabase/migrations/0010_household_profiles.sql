-- Household screen redesign (Thomas, 2026-07-18): the members list shows
-- every member's name and email, and the household can carry an image.
--
-- Until now each phone only knew its OWN user (auth metadata is private),
-- so a member directory needs its own table. profiles mirrors the bits of
-- auth.users the household may see (first name + email), kept in sync by
-- triggers on auth.users – the app never writes profiles directly:
-- signup inserts the row, and auth.updateUser (first-name edits on the new
-- Edit profile sheet) updates it through the same trigger.

-- The household image ("Add an image" on the Edit household sheet).
-- Uploads reuse the recipe-photos bucket – its policies are already
-- namespaced per household folder, which fits the household image too.
alter table public.households
  add column image_url text;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- True when the given user shares at least one household with the caller.
-- SECURITY DEFINER like is_household_member, so the profiles policy can
-- look at household_members without tripping over its RLS.
create or replace function public.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members mine
    join household_members theirs using (household_id)
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

alter table public.profiles enable row level security;

-- Readable by yourself and your household mates; writable only through
-- the auth triggers below (no insert/update policies for clients).
create policy profiles_select on public.profiles
  for select using (
    user_id = auth.uid() or public.shares_household_with(user_id)
  );

-- Mirror auth.users → profiles on signup and on every auth change (email
-- change, first_name metadata update via supabase.auth.updateUser).
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, first_name, email)
  values (new.id, new.raw_user_meta_data ->> 'first_name', new.email)
  on conflict (user_id) do update
    set first_name = excluded.first_name,
        email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Backfill the existing users (Thomas + Pia and any future re-run: no-op).
insert into public.profiles (user_id, first_name, email)
select id, raw_user_meta_data ->> 'first_name', email
from auth.users
on conflict (user_id) do nothing;

-- Verifying SELECT (lesson from 0008). Expect one row: profile_count ≥ the
-- number of signed-up users (2 today), image_column_exists = true.
select
  (select count(*) from public.profiles) as profile_count,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'households'
      and column_name = 'image_url'
  ) as image_column_exists;
