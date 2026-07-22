-- Prep+Eat – leave a household with copy-on-leave (docs/leave-household.md).
--
-- Leaving copies the household's live recipes into a fresh personal
-- "<Firstname>'s Kitchen" for the leaver, re-attributed to them (GDPR: the
-- copy carries no other member's name), then ends their membership. Recipes
-- only – the meal plan and shopping list stay with the family. You cannot
-- leave a household where you are the only member (nothing to leave).
--
-- One atomic transaction (SECURITY DEFINER, so it runs as the owner and is
-- not blocked by RLS while inserting into the new household). Photos can't be
-- copied in SQL – storage files live outside Postgres – so the function
-- returns the new recipe ids + their source image URLs and the CLIENT copies
-- the files afterwards (the recipe-photos bucket is public-read, so the
-- departed member can still read the originals; they only need write access
-- to their own new household's folder, which they have).

create or replace function public.leave_household(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_member_count int;
  v_first_name text;
  v_new_household_id uuid;
  v_new_name text;
  v_rec record;
  v_new_recipe_id uuid;
  v_photos jsonb := '[]'::jsonb;
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

  -- A solo household has nobody to leave – leaving it would just abandon it.
  select count(*) into v_member_count
  from household_members where household_id = p_household_id;
  if v_member_count <= 1 then
    raise exception 'You are the only member – there is nothing to leave';
  end if;

  -- Auto-name the personal kitchen "<Firstname>'s Kitchen" (fallback "My
  -- Kitchen" if the profile has no first name).
  select first_name into v_first_name from profiles where user_id = v_user;
  v_new_name := coalesce(nullif(btrim(v_first_name), ''), 'My') || '''s Kitchen';

  insert into households (name, created_by_user_id)
  values (v_new_name, v_user)
  returning id into v_new_household_id;

  insert into household_members (household_id, user_id)
  values (v_new_household_id, v_user);

  -- Copy every live recipe (+ ingredients + steps), re-attributed to the
  -- leaver, linked back via forked_from_recipe_id. image_url stays null until
  -- the client copies the photo file and points the copy at the new path.
  for v_rec in
    select * from recipes
    where household_id = p_household_id and deleted_at is null
  loop
    insert into recipes (
      household_id, created_by_user_id, title, description, servings,
      prep_minutes, cook_minutes, image_url, source_url,
      forked_from_recipe_id, is_favorite
    ) values (
      v_new_household_id, v_user, v_rec.title, v_rec.description, v_rec.servings,
      v_rec.prep_minutes, v_rec.cook_minutes, null, v_rec.source_url,
      v_rec.id, v_rec.is_favorite
    )
    returning id into v_new_recipe_id;

    insert into recipe_ingredients (recipe_id, name, quantity, unit, note, sort_order)
    select v_new_recipe_id, name, quantity, unit, note, sort_order
    from recipe_ingredients where recipe_id = v_rec.id;

    insert into recipe_steps (recipe_id, step_number, text)
    select v_new_recipe_id, step_number, text
    from recipe_steps where recipe_id = v_rec.id;

    if v_rec.image_url is not null then
      v_photos := v_photos || jsonb_build_object(
        'recipeId', v_new_recipe_id,
        'sourceUrl', v_rec.image_url
      );
    end if;
  end loop;

  -- Leave the old household.
  delete from household_members
  where household_id = p_household_id and user_id = v_user;

  return jsonb_build_object(
    'household', jsonb_build_object(
      'id', v_new_household_id, 'name', v_new_name, 'image_url', null
    ),
    'photos', v_photos
  );
end;
$$;

grant execute on function public.leave_household(uuid) to authenticated;

-- Verifying SELECT (lesson from earlier migrations: the SQL editor runs only
-- the highlighted text if any is selected – click once to clear the selection
-- before Run). Expect function_exists = true.
select exists (
  select 1 from pg_proc where proname = 'leave_household'
) as function_exists;
