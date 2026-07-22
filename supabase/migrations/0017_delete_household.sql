-- Prep+Eat – delete a household you no longer want (backlog "Delete household").
--
-- Only for a household where you are the SOLE member: its recipes, meal plans
-- and shopping lists are yours alone, so deleting them harms no one. A shared
-- (multi-member) household uses Leave instead – deleting it would wipe every
-- member's data, and the app has no roles. You also cannot delete your only
-- household (the always-belong-to-≥1 invariant).
--
-- Deleting the household row cascades everything hanging off it (recipes,
-- meal_plans, shopping_lists, household_members, invites, category memory –
-- all `on delete cascade`). SECURITY DEFINER so the row delete isn't blocked
-- by RLS. Recipe photos of the deleted household stay orphaned in storage
-- (no personal data) – same follow-up as delete_profile.

create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_member_count int;
  v_other_count int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = v_user
  ) then
    raise exception 'You are not a member of this household';
  end if;

  -- Sole member only – a shared household must be left, not deleted.
  select count(*) into v_member_count
  from household_members where household_id = p_household_id;
  if v_member_count > 1 then
    raise exception 'This household has other members – leave it instead of deleting';
  end if;

  -- Keep at least one household.
  select count(*) into v_other_count
  from household_members
  where user_id = v_user and household_id <> p_household_id;
  if v_other_count = 0 then
    raise exception 'This is your only household – you must keep at least one';
  end if;

  delete from households where id = p_household_id;
end;
$$;

grant execute on function public.delete_household(uuid) to authenticated;

-- Verifying SELECT (click once to clear any selection before Run). Expect
-- function_exists = true.
select exists (
  select 1 from pg_proc where proname = 'delete_household'
) as function_exists;
