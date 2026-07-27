-- 0023: put meal_plans.pushed_to_list_at back, because the phones still ask
-- for it. URGENT – this is the fix for "the plan won't load" (2026-07-27).
--
-- WHAT HAPPENED
-- 0022 dropped the column the same day the client stopped selecting it. Those
-- are two different clocks. The REPO stopped reading it at commit f8b5a17; the
-- APP ON THE PHONES is TestFlight build 10 (2026-07-25), and build 10's
-- fetchWeeks still asks for:
--     select id, week_start_date, pushed_to_list_at, updated_at, deleted_at
-- With the column gone, PostgREST rejects the whole request (42703, "column
-- meal_plans.pushed_to_list_at does not exist"), fetchWeeks throws, and the
-- Plan tab's boot never reaches its "ready" dispatch – so it spins forever.
-- Recipes and Shopping are unaffected: no other query named the column.
--
-- WHY RESTORING IS SAFE
-- The column is meaningless and stays that way. Nothing writes it any more
-- (0022 already removed the stamp from push_plan_to_list, and that stays
-- removed here), and no client build ever READ its value – build 10 maps it
-- onto a PlanWeek field nobody consults. Restoring it always-null gives build
-- 10 exactly the behaviour it shipped with, and current HEAD does not select
-- it at all. Pure compatibility shim.
--
-- The data 0022 discarded is not recreated. It does not need to be: the flag
-- it held ("has this week been pushed to the list") stopped meaning anything
-- at decision #8, when every meal started contributing on write.
--
-- HOW IT GOES AWAY FOR REAL
-- Re-drop it only once no INSTALLED build selects it – i.e. after a build
-- without it (11 or later) is on every tester's phone, not merely committed
-- here. Tracked in the backlog under Code debts.

alter table public.meal_plans
  add column if not exists pushed_to_list_at timestamptz;

comment on column public.meal_plans.pushed_to_list_at is
  'Vestigial (decision #8). Never read, never written – restored by 0023 only '
  'so TestFlight build 10 and earlier can still SELECT it. Drop again once no '
  'installed build names it.';

-- Verifying SELECT (lesson from 0008/0010): click once in the editor to clear
-- any selection before Run, so the whole file executes.
-- Expect column_back = 1 and still_stamped = false.
select
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meal_plans'
      and column_name = 'pushed_to_list_at'
  ) as column_back,
  (
    select pg_get_functiondef(p.oid) like '%pushed_to_list_at%'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'push_plan_to_list'
  ) as still_stamped;
