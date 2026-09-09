-- CNS Creator OS — Phase 4: Course curriculum (modules/lessons) + Storage
-- 2026-09-06
--
-- Two jobs:
--   1. RLS repair for modules + lessons, mirroring the Phase 3 repair on
--      storefronts/landing_pages/products/courses. The live project backs its
--      policies with is_own_course()/is_own_module()/is_own_lesson() helpers
--      that lack EXECUTE grants for the roles that need them, so even the
--      owner's own CRUD fails with "permission denied for function is_own_*".
--      Apply AFTER the Phase 3 migration (the EXISTS subqueries below read
--      public.courses, whose own RLS must already be repaired).
--   2. Provision the four storage buckets the app uploads to (live project
--      currently has zero buckets, so every upload would fail) and the
--      storage.objects policies the browser client needs. All statements are
--      idempotent (guard checks + on-conflict upserts), safe to re-run.
--
-- Bucket layout (owner folder convention: first path segment = auth.uid()):
--   * uploads        — public read; owner write. VSL thumbnails, testimonial
--                      images/videos, course covers, product covers.
--   * avatars        — public read; owner write.
--   * course-videos  — private, owner only. Lesson videos (up to 2 GB each,
--                      bucket-level file_size_limit override).
--   * product-files  — private, owner only. Delivery files.

-- =============================================================================
-- 1. MODULES + LESSONS — RLS repair (drop-all-then-create, idempotent)
-- =============================================================================
do $$
declare
  t text;
  p text;
begin
  foreach t in array array['modules', 'lessons'] loop
    for p in
      select policyname
        from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- Owner CRUD — via a plain subquery through creators, no helper functions.
create policy "owner read own" on public.modules for select to authenticated
  using (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ));
create policy "owner insert own" on public.modules for insert to authenticated
  with check (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ));
create policy "owner update own" on public.modules for update to authenticated
  using (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ));
create policy "owner delete own" on public.modules for delete to authenticated
  using (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ));

create policy "owner read own" on public.lessons for select to authenticated
  using (exists (
    select 1 from public.courses c
    join public.modules m on m.course_id = c.id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));
create policy "owner insert own" on public.lessons for insert to authenticated
  with check (exists (
    select 1 from public.courses c
    join public.modules m on m.course_id = c.id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));
create policy "owner update own" on public.lessons for update to authenticated
  using (exists (
    select 1 from public.courses c
    join public.modules m on m.course_id = c.id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.courses c
    join public.modules m on m.course_id = c.id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));
create policy "owner delete own" on public.lessons for delete to authenticated
  using (exists (
    select 1 from public.courses c
    join public.modules m on m.course_id = c.id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));

-- =============================================================================
-- 2. STORAGE BUCKETS — create if missing, else align visibility + limits
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads',        'uploads',        true,  262144000,  array['image/*', 'video/*']::text[]),
  ('avatars',        'avatars',        true,  5242880,    array['image/*']::text[]),
  ('course-videos',  'course-videos',  false, 2147483648, array['video/*']::text[]),
  ('product-files',  'product-files',  false, 524288000,  array['application/pdf', 'application/zip', 'application/octet-stream', 'audio/*', 'image/*', 'text/*', 'video/*']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

-- =============================================================================
-- 3. STORAGE POLICIES (storage.objects)
--    Guarded individually so re-runs and coexisting dashboard-created policies
--    are safe. Owner convention: first folder segment equals auth.uid().
-- =============================================================================
alter table storage.objects enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns public read uploads/avatars'
  ) then
    create policy "cns public read uploads/avatars" on storage.objects
      for select to anon, authenticated
      using (bucket_id in ('uploads', 'avatars'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns owner insert'
  ) then
    create policy "cns owner insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id in ('uploads', 'avatars', 'course-videos', 'product-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns owner update'
  ) then
    create policy "cns owner update" on storage.objects
      for update to authenticated
      using (
        bucket_id in ('uploads', 'avatars', 'course-videos', 'product-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id in ('uploads', 'avatars', 'course-videos', 'product-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns owner delete'
  ) then
    create policy "cns owner delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id in ('uploads', 'avatars', 'course-videos', 'product-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'cns private owner read'
  ) then
    create policy "cns private owner read" on storage.objects
      for select to authenticated
      using (
        bucket_id in ('course-videos', 'product-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;
