-- 0027: "1 liter milk" and "2 liters milk" merge again.
--
-- WHAT WAS WRONG
-- 0024 taught item_merge_key to ignore a unit's plural, so "1 clove garlic"
-- and "5 cloves garlic" stop landing as two rows. The rule it used was "drop
-- one trailing s OR r", and the r half backfired: an English unit whose
-- SINGULAR ends in r folds differently from its plural.
--     liter     -> lite      liters     -> liter      (never merge)
--     jar       -> ja        jars       -> jar
--     container -> containe  containers -> container
-- Found 2026-08-02 by the pre-build audit, as known bug 8.
--
-- WHY THE r WAS THERE, AND WHY IT CANNOT STAY
-- It was not a typo. Danish plurals end in -r (dåse -> dåser, pakke ->
-- pakker), so the r half was doing real work for the other half of the
-- household's recipes. That is the whole conflict: English singulars can end
-- in r, Danish plurals do. No single letter rule serves both, so the two
-- cases have to be told apart by name rather than by spelling.
--
-- THE RULE (decided 2026-08-03, Thomas – option A of two)
-- 1. A short explicit list handles the plurals no letter rule can reach:
--    the Danish -r/-er plurals, and Danish irregulars like bægre.
-- 2. English sibilant plurals lose "es": pinches -> pinch, bunches -> bunch.
--    0024 got these wrong too (pinches -> pinche), so this is a second small
--    fix riding along.
-- 3. Anything else loses one trailing "s": cloves -> clove, liters -> liter.
-- Blanket s-stripping is safe even for the Danish units that END in s, and
-- this is the reason the s half of 0024 never caused trouble: glas and ris
-- are the same word in the plural, so both forms fold to the same key
-- whatever the rule does to them. It is only a rule that folds singular and
-- plural DIFFERENTLY that splits a row.
-- The explicit list is the same shape the app already uses on the client
-- (UNIT_SINGULARS in src/lib/quantity.ts), whose comment warned against
-- exactly the blanket strip 0024 shipped. Two lists in two languages is the
-- accepted cost; the alternative was a full unit map in SQL, which is a
-- bigger list to keep in step for no extra coverage today.
--
-- WHAT IS NOT COVERED, ON PURPOSE
-- A plural that is neither on the list nor formed with s/es falls through to
-- an exact match, which is the pre-0024 behaviour: the two rows split. That
-- is visible on the list and fixable by hand, and adding a line here is
-- cheap when a real one turns up.
-- Still only the UNIT. "onion" vs "yellow onion" is a synonym question, not
-- a spelling one – see Teach-a-synonym under Later in the backlog.
--
-- EXISTING ROWS
-- Same as 0024: this changes how rows are MATCHED from now on, it does not
-- rewrite data. A week's list that already holds milk twice keeps holding it
-- twice until that week is rebuilt (remove the meals and add them again).
-- New weeks, and any meal added after this runs, merge correctly.
--
-- SAFE FOR THE PHONES (the 0022 lesson)
-- Only a function BODY is replaced – no signature change, nothing dropped,
-- and item_merge_key is called at runtime rather than stored in a column or
-- an index, so there is nothing to reindex. TestFlight builds 12 and 13 keep
-- working unchanged, and they pick up the better merging immediately because
-- the merge happens on the server.

create or replace function public.norm_item_unit(p_unit text)
returns text
language sql
immutable
as $$
  with cleaned as (
    select lower(
             trim(regexp_replace(replace(coalesce(p_unit, ''), E'\u00A0', ' '), '\s+', ' ', 'g'))
           ) as u
  ),
  -- Step 1: the plurals no letter rule reaches. Danish forms its plural with
  -- -r or -er, so the singular is what is left after removing it – which no
  -- rule can tell apart from an English singular that simply ends in r.
  irregular as (
    select u,
           case u
             when 'dåser' then 'dåse'
             when 'pakker' then 'pakke'
             when 'kopper' then 'kop'
             when 'skiver' then 'skive'
             when 'poser' then 'pose'
             when 'plader' then 'plade'
             when 'stykker' then 'stykke'
             when 'bundter' then 'bundt'
             when 'bægre' then 'bæger'
             when 'håndfulde' then 'håndfuld'
             -- Legacy spelling, carried over from 0024's bonus: rows written
             -- "gr" for grams before the importer settled on "g".
             when 'gr' then 'g'
           end as override
      from cleaned
  ),
  -- Step 2: English plurals of sibilant stems lose "es" (pinches, bunches,
  -- dashes, boxes). Chained INTO step 3 rather than instead of it, so
  -- glasses -> glass -> glas meets glas coming the other way.
  desibilated as (
    select override,
           case when u ~ '(ch|sh|s|x|z)es$' then left(u, length(u) - 2) else u end as u
      from irregular
  ),
  -- Step 3: the ordinary English plural. The length guard means a unit that
  -- is just "s" could never fold to the empty string.
  singular as (
    select override,
           case when length(u) > 1 and right(u, 1) = 's' then left(u, length(u) - 1) else u end as u
      from desibilated
  )
  select coalesce(override, u) from singular;
$$;

comment on function public.norm_item_unit(text) is
  'Folds a unit to its identity form so the shopping list merges "1 liter" '
  'with "2 liters" and "1 clove" with "5 cloves". Never shown to anyone: the '
  'list displays whichever natural form was stored first. See migration 0027, '
  'which replaced 0024''s blanket s-or-r strip.';

-- Verifying SELECT (lesson from 0008/0010): click once to clear any selection
-- before Run, so the whole file executes. Expect all eight columns = true.
-- The first three are bug 8; the rest prove 0024's good behaviour survived.
select
  public.norm_item_unit('liters') = public.norm_item_unit('liter') as liter_fixed,
  public.norm_item_unit('jars') = public.norm_item_unit('jar') as jar_fixed,
  public.norm_item_unit('containers') = public.norm_item_unit('container') as container_fixed,
  public.norm_item_unit('cloves') = public.norm_item_unit('clove') as cloves_still_merge,
  public.norm_item_unit('dåser') = public.norm_item_unit('dåse') as danish_still_merges,
  public.norm_item_unit('pinches') = public.norm_item_unit('pinch') as pinches_now_merge,
  public.norm_item_unit('gr') = public.norm_item_unit('g') as legacy_grams_kept,
  public.norm_item_unit('l') = 'l' and public.norm_item_unit('oz') = 'oz'
    and public.norm_item_unit('tsp') = 'tsp' as short_units_untouched;
