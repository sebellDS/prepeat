-- Madapp – initial schema (minimal slice: what the shopping list needs).
-- Recipes and meal plans arrive in later migrations; shopping_list_items
-- therefore keeps source_entry_id as a plain uuid until meal_plan_entries
-- exists to reference.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, household_id)
);

create index household_members_household_id_idx
  on public.household_members (household_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz,
  used_by_user_id uuid references auth.users (id)
);

-- Membership check used by nearly every policy. SECURITY DEFINER so policies
-- on household_members itself can call it without infinite recursion.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from household_members
    where household_id = p_household_id
      and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Shopping lists
-- ---------------------------------------------------------------------------

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null default 'Indkøbsliste',
  week_start_date date,
  created_by_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shopping_lists_household_id_idx
  on public.shopping_lists (household_id);

create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  aisle text,
  is_checked boolean not null default false,
  checked_by_user_id uuid references auth.users (id),
  checked_at timestamptz,
  added_manually boolean not null default true,
  -- Will reference meal_plan_entries (id) once that table exists.
  source_entry_id uuid,
  created_by_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_list_items_list_id_idx
  on public.shopping_list_items (list_id);

create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

-- Households: members can see and rename; anyone can create their own.
create policy households_select on public.households
  for select using (public.is_household_member(id));

create policy households_insert on public.households
  for insert with check (created_by_user_id = auth.uid());

create policy households_update on public.households
  for update using (public.is_household_member(id));

-- Members: visible to fellow members. Joining happens in two ways only –
-- the creator bootstraps their own membership, or join_household_with_code()
-- (security definer) inserts on the user's behalf after validating an invite.
create policy household_members_select on public.household_members
  for select using (public.is_household_member(household_id));

create policy household_members_insert_creator on public.household_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by_user_id = auth.uid()
    )
  );

create policy household_members_delete_self on public.household_members
  for delete using (user_id = auth.uid());

-- Invites: managed by members. Redemption goes through the RPC below, so
-- non-members never need direct access to this table.
create policy household_invites_select on public.household_invites
  for select using (public.is_household_member(household_id));

create policy household_invites_insert on public.household_invites
  for insert with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
  );

-- Shopping lists and items: full access for household members.
create policy shopping_lists_all on public.shopping_lists
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy shopping_list_items_all on public.shopping_list_items
  for all using (
    exists (
      select 1 from public.shopping_lists l
      where l.id = list_id
        and public.is_household_member(l.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.shopping_lists l
      where l.id = list_id
        and public.is_household_member(l.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Invite redemption
-- ---------------------------------------------------------------------------

-- Validates an invite code and joins the calling user to the household.
-- SECURITY DEFINER because the caller is not yet a member and therefore
-- cannot read household_invites or insert into household_members directly.
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
    and used_at is null
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

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- The shopping list is the realtime surface in v1. REPLICA IDENTITY FULL so
-- update/delete events carry the previous row to subscribers.
alter table public.shopping_list_items replica identity full;
alter table public.shopping_lists replica identity full;

alter publication supabase_realtime add table public.shopping_list_items;
alter publication supabase_realtime add table public.shopping_lists;
