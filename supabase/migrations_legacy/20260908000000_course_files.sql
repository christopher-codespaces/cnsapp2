-- CNS Creator OS — Course lesson files (private, read-only PDFs)
-- 2026-09-08
--
-- Adds the private `course-files` bucket for lesson PDFs (worksheets, notes)
-- plus the storage objects policies the browser client needs. PDFs stay out of
-- public buckets so students can only ever view them inline via a signed URL —
-- there is no public download link anywhere in the app.
--
-- Quizzes need no schema: they live in `lessons.content` jsonb (see
-- types/course.ts). Idempotent (guards + on-conflict upsert). Apply after the
-- Phase 4 courses/storage migration.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-files', 'course-files', false, 104857600, array['application/pdf']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns owner course-files read'
  ) then
    create policy "cns owner course-files read" on storage.objects
      for select to authenticated
      using (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns owner course-files insert'
  ) then
    create policy "cns owner course-files insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns owner course-files update'
  ) then
    create policy "cns owner course-files update" on storage.objects
      for update to authenticated
      using (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns owner course-files delete'
  ) then
    create policy "cns owner course-files delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;