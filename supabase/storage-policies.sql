-- supabase/storage-policies.sql
-- Storage buckets + RLS policies for Clerk-authenticated uploads.
--
-- The app uploads to a per-user folder:  <bucket>/<clerk_user_id>/<file>
-- and authorizes via the Clerk session token, so the first path segment must
-- equal the Clerk subject (auth.jwt() ->> 'sub'). The existing
-- clerk-rls-migration.sql only covers TABLE rls, not storage.objects, which is
-- why image / audio uploads were denied by RLS.
--
-- Safe to run multiple times. Run it in the Supabase SQL editor.

-- 1. Ensure the buckets exist and are public-read (cards reference public URLs).
insert into storage.buckets (id, name, public)
values ('flashcard-images', 'flashcard-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('flashcard-audio', 'flashcard-audio', true)
on conflict (id) do update set public = true;

-- 2. Per-bucket policies scoped to the uploader's own folder (= Clerk user id).

-- ---- flashcard-images ----------------------------------------------------
drop policy if exists "flashcard_images_read"       on storage.objects;
drop policy if exists "flashcard_images_insert_own" on storage.objects;
drop policy if exists "flashcard_images_update_own" on storage.objects;
drop policy if exists "flashcard_images_delete_own" on storage.objects;

create policy "flashcard_images_read"
  on storage.objects for select
  to public
  using (bucket_id = 'flashcard-images');

create policy "flashcard_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

create policy "flashcard_images_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

create policy "flashcard_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'flashcard-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

-- ---- flashcard-audio -----------------------------------------------------
drop policy if exists "flashcard_audio_read"       on storage.objects;
drop policy if exists "flashcard_audio_insert_own" on storage.objects;
drop policy if exists "flashcard_audio_update_own" on storage.objects;
drop policy if exists "flashcard_audio_delete_own" on storage.objects;

create policy "flashcard_audio_read"
  on storage.objects for select
  to public
  using (bucket_id = 'flashcard-audio');

create policy "flashcard_audio_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flashcard-audio'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

create policy "flashcard_audio_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'flashcard-audio'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'flashcard-audio'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

create policy "flashcard_audio_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'flashcard-audio'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );
