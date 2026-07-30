-- 0024: stop "1 clove garlic" and "5 cloves garlic" landing as two shopping
-- list rows. Found 2026-07-29 (Thomas, looking at the week-32 demo list:
-- "a lot of item are the same, but named differently").
--
-- WHAT WAS WRONG
-- item_merge_key, from 0013, is:
--     norm_item_name(name) || ' ' || lower(trim(unit))
-- The unit goes in raw, so two rows merge only when the unit string matches
-- character for character. Recipe sites do not agree on that: BBC writes
-- "1 clove garlic", RecipeTin writes "2 garlic cloves", Hot Thai Kitchen
-- writes "5 cloves garlic". Once the importer settled the NAME to "garlic"
-- in all three (recipe-import.ts, same day), the unit was the only thing
-- still splitting them – clove vs cloves.
--
-- WHY NOT FIX IT IN THE IMPORTER
-- Folding "cloves" onto "clove" there would make the merged row print
-- "8 clove garlic". The unit is display text as well as identity, and those
-- two jobs want different answers. Normalising INSIDE the key separates
-- them: rows merge on "clove", while the list keeps whichever natural form
-- was stored first (push_plan_to_list already takes display name and unit
-- from the first occurrence by sort_order, not from the key).
--
-- THE RULE
-- Drop one trailing "s" or "r" from the unit, for the key only. That covers
-- English plurals (cloves, cups, slices, sprigs, heads, cans, pieces,
-- sticks) and the Danish -r plurals (dåser→dåse, pakker→pakke, skiver→skive,
-- poser→pose, plader→plade). It is deliberately NOT a general stemmer:
--   * one-character units are left alone, so "s" could never become "".
--   * units with no trailing s/r are untouched: g, kg, ml, dl, tsp, tbsp,
--     oz, fed, stk, tsk, spsk, knsp, pinch, håndfuld.
--   * a few fold to something that is not a word – glas→gla, ps→p,
--     bæger→bæge – which is harmless, because the key is never shown and no
--     other unit folds onto the same string.
--   * "gr" folds to "g", which is a small bonus: legacy rows written "gr"
--     now merge with "g".
-- Trailing "e" is deliberately NOT stripped. It would fold liter→lit and
-- litre→litr differently and merge nothing, while making every English
-- singular unrecognisable (piece→piec, clove→clov).
--
-- SCOPE
-- Only the unit. Names are untouched: "onion" vs "small onion" and
-- "coriander leaves" vs "fresh cilantro" are synonym questions, not spelling
-- ones, and are logged separately under Known bugs.
--
-- EXISTING ROWS
-- This changes how rows are MATCHED from now on; it does not rewrite data.
-- A list that already holds garlic twice keeps holding it twice until that
-- week's list is rebuilt (remove the meals and add them again). New weeks,
-- and any meal added after this runs, merge correctly.

-- Unit as identity rather than display text.
create or replace function public.norm_item_unit(p_unit text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(
      trim(regexp_replace(replace(coalesce(p_unit, ''), E'\u00A0', ' '), '\s+', ' ', 'g'))
    ),
    '(.+)[sr]$',
    '\1'
  );
$$;

create or replace function public.item_merge_key(p_name text, p_unit text)
returns text
language sql
immutable
as $$
  select public.norm_item_name(p_name) || ' ' || public.norm_item_unit(p_unit);
$$;
