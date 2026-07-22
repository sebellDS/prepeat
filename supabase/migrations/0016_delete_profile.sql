-- Prep+Eat – delete profile / GDPR erasure (docs/delete-account.md).
--
-- Erasing a profile removes the person and every trace that points to them,
-- without destroying the shared content the rest of a household relies on:
--   1. the login, profile (name/email) and memberships are deleted;
--   2. their "added by" / "checked off by" name is cleared from shared recipes,
--      plans and lists (the content stays – it's the family's cookbook now);
--   3. any household where they are the ONLY member is deleted outright
--      (its recipes / plans / lists cascade away).
--
-- Two parts: (A) the attribution columns become nullable and their foreign
-- keys switch to ON DELETE SET NULL, so deleting the auth user auto-clears the
-- name everywhere shared; (B) a delete_profile() RPC that wipes sole-member
-- households, clears the check-off initials, then deletes the auth user.
--
-- Not covered here: recipe photos of deleted sole-member households stay in
-- storage (orphaned, no personal data – random-UUID food images). Flagged as a
-- follow-up; SQL can't remove storage files.

-- ── (A) attribution columns: nullable + ON DELETE SET NULL ─────────────────
-- These were `not null references auth.users(id)` with no on-delete, which
-- both blocks deleting the user and would lose the row. SET NULL keeps the
-- content and clears the name.

alter table public.households alter column created_by_user_id drop not null;
alter table public.households drop constraint households_created_by_user_id_fkey;
alter table public.households add constraint households_created_by_user_id_fkey
  foreign key (created_by_user_id) references auth.users (id) on delete set null;

alter table public.household_invites alter column created_by drop not null;
alter table public.household_invites drop constraint household_invites_created_by_fkey;
alter table public.household_invites add constraint household_invites_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.household_invites drop constraint household_invites_used_by_user_id_fkey;
alter table public.household_invites add constraint household_invites_used_by_user_id_fkey
  foreign key (used_by_user_id) references auth.users (id) on delete set null;

alter table public.shopping_lists alter column created_by_user_id drop not null;
alter table public.shopping_lists drop constraint shopping_lists_created_by_user_id_fkey;
alter table public.shopping_lists add constraint shopping_lists_created_by_user_id_fkey
  foreign key (created_by_user_id) references auth.users (id) on delete set null;

alter table public.shopping_list_items alter column created_by_user_id drop not null;
alter table public.shopping_list_items drop constraint shopping_list_items_created_by_user_id_fkey;
alter table public.shopping_list_items add constraint shopping_list_items_created_by_user_id_fkey
  foreign key (created_by_user_id) references auth.users (id) on delete set null;

alter table public.shopping_list_items drop constraint shopping_list_items_checked_by_user_id_fkey;
alter table public.shopping_list_items add constraint shopping_list_items_checked_by_user_id_fkey
  foreign key (checked_by_user_id) references auth.users (id) on delete set null;

alter table public.recipes alter column created_by_user_id drop not null;
alter table public.recipes drop constraint recipes_created_by_user_id_fkey;
alter table public.recipes add constraint recipes_created_by_user_id_fkey
  foreign key (created_by_user_id) references auth.users (id) on delete set null;

alter table public.meal_plans alter column created_by_user_id drop not null;
alter table public.meal_plans drop constraint meal_plans_created_by_user_id_fkey;
alter table public.meal_plans add constraint meal_plans_created_by_user_id_fkey
  foreign key (created_by_user_id) references auth.users (id) on delete set null;

-- ── (B) the erasure function ───────────────────────────────────────────────

create or replace function public.delete_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete households where the caller is the ONLY member (cascades their
  -- recipes, meal plans and shopping lists). Shared households are left alone.
  delete from households h
  where exists (
    select 1 from household_members hm
    where hm.household_id = h.id and hm.user_id = v_user
  )
  and (select count(*) from household_members hm2 where hm2.household_id = h.id) = 1;

  -- Clear the free-text check-off initial (not a foreign key, so it isn't
  -- auto-nulled) on shared lists.
  update shopping_list_items set checked_by_initial = null
  where checked_by_user_id = v_user;

  -- Erase the account. Cascades profile (0010), memberships (0001) and invite
  -- redemptions (0012); the ON DELETE SET NULL foreign keys above clear the
  -- name from every shared recipe / plan / list / invite.
  delete from auth.users where id = v_user;
end;
$$;

grant execute on function public.delete_profile() to authenticated;

-- Verifying SELECT (click once to clear any selection before Run). Expect
-- function_exists = true and all eight columns is_nullable = YES.
select
  exists (select 1 from pg_proc where proname = 'delete_profile') as function_exists,
  (
    select count(*) from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'households' and column_name = 'created_by_user_id') or
        (table_name = 'household_invites' and column_name = 'created_by') or
        (table_name = 'shopping_lists' and column_name = 'created_by_user_id') or
        (table_name = 'shopping_list_items' and column_name = 'created_by_user_id') or
        (table_name = 'recipes' and column_name = 'created_by_user_id') or
        (table_name = 'meal_plans' and column_name = 'created_by_user_id')
      )
      and is_nullable = 'YES'
  ) as nullable_columns;
