-- Prep+Eat – scope recipe-photo listing to your own households.
--
-- 0006 created recipe_photos_read as `for select using (bucket_id =
-- 'recipe-photos')`, which lets ANY client enumerate every photo path in the
-- bucket (Supabase's "clients can list all files" warning). That undermines
-- the bucket's "unguessable UUID URL" privacy model. Scope SELECT to members
-- of the folder's household, matching the insert/update/delete policies.
--
-- What this does NOT affect: displaying a photo. The bucket is public, so
-- `/object/public/...` URLs are served without RLS – the app shows recipes via
-- those public URLs, and copy-on-leave now fetches originals via the public
-- URL too (0018 client change). The authenticated list/copy/remove APIs are
-- what this scopes: the delete-time photo cleanup (list+remove) still works
-- because it runs while you are still a member.

drop policy recipe_photos_read on storage.objects;

create policy recipe_photos_read on storage.objects
  for select using (
    bucket_id = 'recipe-photos'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

-- Verifying SELECT (click once to clear any selection before Run). Expect
-- policy_count = 1.
select count(*) as policy_count
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'recipe_photos_read';
