-- Recipe ingredient lists have SECTION HEADERS, and we were importing them as
-- ingredients.
--
-- Found by Thomas on 2026-08-04, importing ambitiouskitchen.com's cinnamon
-- rolls: "DOUGH", "FILLING" and "CREAM CHEESE FROSTING" arrived as three
-- ingredients with no amount. Schema.org's `recipeIngredient` is a flat list of
-- strings, so a site that groups its ingredients has nowhere to say so - the
-- heading is just another entry.
--
-- The harm is not cosmetic: push_plan_to_list happily creates shopping-list
-- items with a null quantity, so planning that recipe puts "DOUGH" on the
-- shopping list beside the milk.
--
-- WHY A FLAG AND NOT A SEPARATE TABLE: headers are POSITIONAL - one applies to
-- everything after it until the next one. That is how recipes are written and
-- how the data arrives, and it keeps sort_order the single source of order.
-- Nesting ingredients inside section rows would invent a structure the source
-- never had.
--
-- Nothing is dropped at import. The heading is real information - "salted
-- butter" appears three times in that recipe with different amounts, and
-- without the headings you cannot tell which is which while baking. The
-- shopping list still merges all three into one line, because merging happens
-- there on normalised name + unit and never looks at sections.
--
-- SAFE FOR THE PHONES (the 0022 lesson): this only ADDS a column with a
-- default, and every installed build selects named columns rather than *, so
-- builds 12/13/14 are unaffected. They keep importing headers as ingredients
-- until they are updated - the app half of this needs a build, the column does
-- not.

alter table recipe_ingredients
  add column if not exists is_section boolean not null default false;

comment on column recipe_ingredients.is_section is
  'True when this row is a section heading ("DOUGH", "For the filling:") rather '
  'than an ingredient. Positional: it applies to every following row until the '
  'next heading. Never pushed to the shopping list.';

-- Deliberately NOT backfilled. Existing recipes keep their header rows as
-- ordinary ingredients until Thomas decides whether to sweep them: the
-- detection is a heuristic, production holds 115 real recipes, and mis-flagging
-- one hides an ingredient somebody is cooking from tonight.
