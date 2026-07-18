-- Prep+Eat – a creator's access ends when they leave (security fix).
--
-- 0004 let a household's creator always read the household row, and 0001's
-- bootstrap membership policy let the creator insert their own membership as
-- long as they created the household. Both keyed on "did you create it", not
-- "are you still a member", so a creator who left kept read access forever and
-- could silently re-add themselves without an invite – regaining every recipe,
-- plan and shopping list the remaining members still use.
--
-- The legitimate need those two policies serve is the creation handshake only:
-- for the instant between "insert the household" and "insert my membership",
-- the creator is not a member yet. That window is exactly "I created it AND it
-- has no members yet". Once anyone is a member, only members get in.
--
-- The members-existence test must ignore the caller's RLS: a non-member sees
-- zero household_members rows, so a plain sub-select would read "no members"
-- and wrongly let a departed creator back in. A SECURITY DEFINER helper (same
-- trick as is_household_member / shares_household_with) checks the real count.

create or replace function public.household_has_members(p_household_id uuid)
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
  );
$$;

-- Households: members see their household; the creator sees it only during the
-- pre-membership bootstrap window (no members yet). A departed creator, whose
-- household still has the remaining members, no longer matches either arm.
drop policy households_select on public.households;

create policy households_select on public.households
  for select using (
    public.is_household_member(id)
    or (
      created_by_user_id = auth.uid()
      and not public.household_has_members(id)
    )
  );

-- Members: the creator may bootstrap their own membership only while the
-- household has no members. After that, joining is exclusively through
-- join_household_with_code() (SECURITY DEFINER, so it is unaffected by this
-- policy) – closing the re-insert path for a creator who has left.
drop policy household_members_insert_creator on public.household_members;

create policy household_members_insert_creator on public.household_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by_user_id = auth.uid()
    )
    and not public.household_has_members(household_id)
  );

-- Verifying SELECT (lesson from 0008/0010): the editor runs only the
-- highlighted text if any is selected, so click once to clear the selection
-- before Run. Expect helper_exists = true and both policy counts = 1.
select
  exists (
    select 1 from pg_proc where proname = 'household_has_members'
  ) as helper_exists,
  (
    select count(*) from pg_policies
    where tablename = 'households' and policyname = 'households_select'
  ) as households_select_policy_count,
  (
    select count(*) from pg_policies
    where tablename = 'household_members'
      and policyname = 'household_members_insert_creator'
  ) as member_insert_policy_count;
