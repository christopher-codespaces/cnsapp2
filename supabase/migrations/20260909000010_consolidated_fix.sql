-- ============================================================================
-- CNS Creator OS — ONE-PASTE FIX for a project with NO migrations applied.
-- Run this single file in the Supabase SQL Editor (or supabase db push -f)
-- and the whole platform comes online:
--   * public creator profiles view      (/c/<handle> stops 404ing)
--   * repaired RLS on creators, storefronts, landing_pages, products,
--     courses, modules, lessons, orders, analytics_events, subscribers
--     (removes the "permission denied for function is_own_*" errors)
--   * storage buckets: uploads, avatars, course-videos, product-files, course-files
--   * ai_conversations / ai_messages RLS
--   * learners / enrollments / lesson_progress / quiz_attempts
-- Safe to re-run (drop-then-recreate policies; guarded creates).
-- ============================================================================

-- ---------------------------------------------------------------- 1. VIEW ---
create or replace view public.public_creator_profiles as
select id, handle, brand_name, logo_url
from public.creators;
grant select on public.public_creator_profiles to anon, authenticated;

-- ------------------------------------------------------------- 2. POLICIES ---
-- Drop every policy on the app tables, then recreate them role-explicit with
-- NO helper-function dependency.
do $$
declare
  t text;
  p text;
begin
  foreach t in array array[
    'creators','storefronts','landing_pages','products','courses',
    'modules','lessons','orders','analytics_events','subscribers',
    'ai_conversations','ai_messages'
  ] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- creators: owner CRUD
create policy "creators owner select" on public.creators for select to authenticated
  using (user_id = (select auth.uid()));
create policy "creators owner insert" on public.creators for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "creators owner update" on public.creators for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "creators owner delete" on public.creators for delete to authenticated
  using (user_id = (select auth.uid()));

-- storefronts / landing_pages / products / courses: public reads of published,
-- owner full CRUD via creators join.
do $$
declare
  t text;
begin
  foreach t in array array['storefronts','landing_pages','products','courses'] loop
    execute format($f$
      create policy "%I public read" on public.%I for select to anon, authenticated
        using (is_published = true or exists (
          select 1 from public.creators cr
          where cr.id = %I.creator_id and cr.user_id = (select auth.uid())
        ))$f$, t, t, t);
    execute format($f$
      create policy "%I owner insert" on public.%I for insert to authenticated
        with check (exists (
          select 1 from public.creators cr
          where cr.id = %I.creator_id and cr.user_id = (select auth.uid())
        ))$f$, t, t, t);
    execute format($f$
      create policy "%I owner update" on public.%I for update to authenticated
        using (exists (
          select 1 from public.creators cr
          where cr.id = %I.creator_id and cr.user_id = (select auth.uid())
        ))
        with check (exists (
          select 1 from public.creators cr
          where cr.id = %I.creator_id and cr.user_id = (select auth.uid())
        ))$f$, t, t, t, t);
    execute format($f$
      create policy "%I owner delete" on public.%I for delete to authenticated
        using (exists (
          select 1 from public.creators cr
          where cr.id = %I.creator_id and cr.user_id = (select auth.uid())
        ))$f$, t, t, t);
  end loop;
end $$;

-- modules / lessons: owner CRUD through the course chain
create policy "modules owner select" on public.modules for select to authenticated
  using (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ));
create policy "modules owner insert" on public.modules for insert to authenticated
  with check (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ));
create policy "modules owner update" on public.modules for update to authenticated
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
create policy "modules owner delete" on public.modules for delete to authenticated
  using (exists (
    select 1 from public.courses c
    join public.creators cr on cr.id = c.creator_id
    where c.id = modules.course_id and cr.user_id = (select auth.uid())
  ));

create policy "lessons owner select" on public.lessons for select to authenticated
  using (exists (
    select 1 from public.modules m
    join public.courses c on c.id = m.course_id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));
create policy "lessons owner insert" on public.lessons for insert to authenticated
  with check (exists (
    select 1 from public.modules m
    join public.courses c on c.id = m.course_id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));
create policy "lessons owner update" on public.lessons for update to authenticated
  using (exists (
    select 1 from public.modules m
    join public.courses c on c.id = m.course_id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.modules m
    join public.courses c on c.id = m.course_id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));
create policy "lessons owner delete" on public.lessons for delete to authenticated
  using (exists (
    select 1 from public.modules m
    join public.courses c on c.id = m.course_id
    join public.creators cr on cr.id = c.creator_id
    where m.id = lessons.module_id and cr.user_id = (select auth.uid())
  ));

-- orders: owner read; writes service-role only
create policy "orders owner read" on public.orders for select to authenticated
  using (exists (
    select 1 from public.creators cr
    where cr.id = orders.creator_id and cr.user_id = (select auth.uid())
  ));
revoke insert, update, delete on public.orders from anon, authenticated;

-- analytics_events: owner read + public page_view/signup inserts on published pages
create policy "analytics owner read" on public.analytics_events for select to authenticated
  using (exists (
    select 1 from public.creators cr
    where cr.id = analytics_events.creator_id and cr.user_id = (select auth.uid())
  ));
create policy "analytics public page events" on public.analytics_events
  for insert to anon, authenticated
  with check (
    event_type in ('page_view','signup')
    and exists (
      select 1 from public.storefronts s
      where s.creator_id = analytics_events.creator_id and s.is_published
    )
  );

-- subscribers: public insert against published storefronts
create policy "subscribers public insert" on public.subscribers
  for insert to anon, authenticated
  with check (exists (
    select 1 from public.creators cr
    join public.storefronts s on s.creator_id = cr.id
    where cr.id = subscribers.creator_id and s.is_published
  ));

-- AI workspace tables: owner CRUD
create policy "ai conv owner read" on public.ai_conversations for select to authenticated
  using (creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid())));
create policy "ai conv owner insert" on public.ai_conversations for insert to authenticated
  with check (creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid())));
create policy "ai conv owner update" on public.ai_conversations for update to authenticated
  using (creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid())))
  with check (creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid())));
create policy "ai conv owner delete" on public.ai_conversations for delete to authenticated
  using (creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid())));

create policy "ai msg owner read" on public.ai_messages for select to authenticated
  using (exists (
    select 1 from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid()))
  ));
create policy "ai msg owner insert" on public.ai_messages for insert to authenticated
  with check (exists (
    select 1 from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid()))
  ));
create policy "ai msg owner delete" on public.ai_messages for delete to authenticated
  using (exists (
    select 1 from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.creator_id = (select id from public.creators cr where cr.user_id = (select auth.uid()))
  ));

-- ------------------------------- 2b. INTEGRITY (best-effort, dupes-safe) ---
-- One storefront per creator (builder + AI tools assume a single row) and
-- unique landing-page slugs per creator. Exception-guarded so pre-existing
-- duplicate rows can't abort the whole script.
do $$ begin
  begin
    create unique index if not exists storefronts_creator_id_key on public.storefronts (creator_id);
  exception when others then null;
  end;
  begin
    create unique index if not exists landing_pages_creator_id_slug_key on public.landing_pages (creator_id, slug);
  exception when others then null;
  end;
end $$;

-- ------------------------------------------- 3. LEARNERS & STUDENT TABLES ---
create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  source text not null default 'checkout',
  created_at timestamptz not null default now(),
  unique (course_id, learner_id)
);
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (learner_id, lesson_id)
);
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);
revoke all on public.learners, public.enrollments, public.lesson_progress, public.quiz_attempts
  from anon, authenticated;

-- ------------------------------------------------------------- 4. BUCKETS ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads',       'uploads',       true,  262144000,  array['image/*','video/*']::text[]),
  ('avatars',       'avatars',       true,  5242880,    array['image/*']::text[]),
  ('course-videos', 'course-videos', false, 2147483648, array['video/*']::text[]),
  ('product-files', 'product-files', false, 524288000,  array['application/pdf','application/zip','application/octet-stream','audio/*','image/*','text/*','video/*']::text[]),
  ('course-files',  'course-files',  false, 104857600,  array['application/pdf']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

-- alter table storage.objects enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cns public read uploads/avatars') then
    create policy "cns public read uploads/avatars" on storage.objects
      for select to anon, authenticated
      using (bucket_id in ('uploads','avatars'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cns owner insert') then
    create policy "cns owner insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id in ('uploads','avatars','course-videos','product-files','course-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cns owner update') then
    create policy "cns owner update" on storage.objects
      for update to authenticated
      using (
        bucket_id in ('uploads','avatars','course-videos','product-files','course-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id in ('uploads','avatars','course-videos','product-files','course-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cns owner delete') then
    create policy "cns owner delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id in ('uploads','avatars','course-videos','product-files','course-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='cns private owner read') then
    create policy "cns private owner read" on storage.objects
      for select to authenticated
      using (
        bucket_id in ('course-videos','product-files','course-files')
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;
