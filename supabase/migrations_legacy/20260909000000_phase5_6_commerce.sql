-- CNS Creator OS — Phase 5 & 6: Commerce + Student access + Analytics
-- 2026-09-09
--
-- Prepares the live project (whose base schema ships these tables WITHOUT any
-- usable RLS policies — the shipped helpers hit "permission denied for
-- function is_own_*") for:
--   Phase 5  Stripe checkout: customers / orders (creator read, service write)
--   Phase 6  student access: enrollments (email-gated), lesson progress
--            (completed lesson ids), quiz attempts, and public page_view /
--            signup analytics events.
--
-- Everything is idempotent: drop-then-recreate policies, guarded creates.

-- =============================================================================
-- 0. learners — students identified by email (no auth account required)
--    Idempotent because learners.email is UNIQUE — a repeat purchase from the
--    same email upserts instead of failing.
-- =============================================================================
create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 1. access tables (created only if the live schema lacks them)
-- =============================================================================

-- One row per purchased course per learner.
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  source text not null default 'checkout',
  created_at timestamptz not null default now(),
  unique (course_id, learner_id)
);

-- Completed lesson ids per learner+course (the player's "progress" memory).
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (learner_id, lesson_id)
);

-- Quiz submissions from the player.
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  score int not null,
  total int not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 2. RLS repair — orders (drop-all-then-recreate, mirrors phase3/phase4)
-- =============================================================================
do $$
declare
  p text;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'orders'
  loop
    execute format('drop policy %I on public.orders', p);
  end loop;
end $$;

create policy "owner read own orders" on public.orders for select to authenticated
  using (exists (
    select 1 from public.creators cr
    where cr.id = orders.creator_id and cr.user_id = (select auth.uid())
  ));

-- Service-role only writes (checkout API + webhook). Anon/authenticated get
-- nothing: orders are created exclusively by the server.
revoke insert, update, delete on public.orders from anon, authenticated;

-- =============================================================================
-- 3. RLS for the new tables (drop-all-then-recreate each)
-- =============================================================================
do $$
declare
  t text;
  p text;
begin
  foreach t in array array['enrollments', 'lesson_progress', 'quiz_attempts'] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- Service-role only: enrollment and progress are resolved server-side from the
-- learner email; anon/authenticated never touch these tables directly.
revoke all on public.enrollments, public.lesson_progress, public.quiz_attempts
  from anon, authenticated;

-- =============================================================================
-- 4. analytics_events — repair + public page-view insert
-- =============================================================================
do $$
declare
  p text;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'analytics_events'
  loop
    execute format('drop policy %I on public.analytics_events', p);
  end loop;
end $$;

-- Owner dashboard reads.
create policy "owner read own events" on public.analytics_events
  for select to authenticated
  using (exists (
    select 1 from public.creators cr
    where cr.id = analytics_events.creator_id and cr.user_id = (select auth.uid())
  ));

-- Public page-view / signup tracking from published pages (anonymous).
create policy "public insert page events" on public.analytics_events
  for insert to anon, authenticated
  with check (
    event_type in ('page_view', 'signup')
    and exists (
      select 1 from public.storefronts s
      where s.creator_id = analytics_events.creator_id and s.is_published
    )
  );

-- =============================================================================
-- 5b. creators — owner CRUD repair (the AI brand-kit tool + brand kit page
--     write here; helper-based live policies lack EXECUTE grants).
-- =============================================================================
do $$
declare
  p text;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'creators'
  loop
    execute format('drop policy %I on public.creators', p);
  end loop;
end $$;

create policy "owner read own creators" on public.creators for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owner insert own creators" on public.creators for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "owner update own creators" on public.creators for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "owner delete own creators" on public.creators for delete to authenticated
  using (user_id = (select auth.uid()));

-- =============================================================================
-- 5. subscribers public insert — role-explicit and independent of any is_own_*
--    helper (mirrors the phase2/3 repair pattern). Legacy helper-dependent
--    policies are dropped; an explicit policy is created when none remains.
-- =============================================================================
do $$
declare
  p text;
  has_insert_policy boolean;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'subscribers'
      and coalesce(qual, '') || coalesce(with_check, '') ~* 'is_own_'
  loop
    execute format('drop policy %I on public.subscribers', p);
  end loop;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscribers' and cmd = 'INSERT'
  ) into has_insert_policy;

  if not has_insert_policy then
    create policy "public can subscribe" on public.subscribers
      for insert to anon, authenticated
      with check (exists (
        select 1 from public.creators cr
        join public.storefronts s on s.creator_id = cr.id
        where cr.id = subscribers.creator_id and s.is_published
      ));
  end if;
end $$;
