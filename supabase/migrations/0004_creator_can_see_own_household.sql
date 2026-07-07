-- Prep+Eat – fix the household-creation chicken-and-egg.
-- households_select required membership, but at creation time the creator is
-- not a member yet: the INSERT's RETURNING clause found no visible row, and
-- the bootstrap membership policy's EXISTS check on households saw nothing
-- either. Creators can now always see households they created.

drop policy households_select on public.households;

create policy households_select on public.households
  for select using (
    public.is_household_member(id)
    or created_by_user_id = auth.uid()
  );

-- Sweep up memberless households orphaned by the bug above (the insert
-- committed, the app never learned the id, no membership was created).
delete from public.households h
where not exists (
  select 1 from public.household_members m where m.household_id = h.id
);
