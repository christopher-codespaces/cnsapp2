-- =============================================================================
-- Buyer accounts: real auth for students
-- -----------------------------------------------------------------------------
-- Buyers get actual auth.users accounts (same auth system creators use). A
-- trigger links every account to its learners row by email, so purchases made
-- via guest email-checkout attach to the account automatically.
--
-- Idempotent. Safe to re-run.
-- =============================================================================

-- 0. repair legacy lesson_progress shape (live table pre-dates the learner   --
--    model: it used customer_id and lacked learner_id/course_id) --------------
do $$
declare r record;
begin
  -- constraints referencing the legacy column must go before the column does
  for r in
    select conname from pg_constraint
    where conrelid = 'public.lesson_progress'::regclass
      and pg_get_constraintdef(oid) ilike '%customer_id%'
      and contype in ('u', 'p', 'f')
  loop
    execute format('alter table public.lesson_progress drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.lesson_progress
  add column if not exists learner_id uuid references public.learners(id) on delete cascade,
  add column if not exists course_id uuid references public.courses(id) on delete cascade;

-- migrate legacy rows (rows pointing at the retired customers table are
-- un-migratable residue and are removed)
delete from public.lesson_progress
where customer_id is not null
  and customer_id not in (select id from public.learners);

update public.lesson_progress
set learner_id = customer_id
where learner_id is null and customer_id is not null;

alter table public.lesson_progress
  alter column learner_id set not null;

-- The legacy customer_id column stays (a view depends on it) but the app
-- ignores it from here on.

create unique index if not exists lesson_progress_learner_lesson_key
  on public.lesson_progress (learner_id, lesson_id);
create index if not exists lesson_progress_learner_course_idx
  on public.lesson_progress (learner_id, course_id);

-- 1. learners gets a link to the auth account --------------------------------
alter table public.learners
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists learners_auth_user_id_key
  on public.learners (auth_user_id)
  where auth_user_id is not null;

-- 2. keep learners in sync with auth.users ------------------------------------
create or replace function public.link_learner_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.learners (email, auth_user_id)
  values (new.email, new.id)
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id
    where public.learners.auth_user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_learner_on_signup();

-- 3. backfill: link any existing auth users + ensure learner rows exist -------
insert into public.learners (email, auth_user_id)
select u.email, u.id
from auth.users u
where u.email is not null
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id
  where public.learners.auth_user_id is null;

-- 4. buyer-facing RLS: a signed-in user may read + act on ONLY their own rows -
-- (all helper functions are security definer + stable to avoid recursion)

create or replace function public.own_learner_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select l.id from public.learners l
  where l.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.owns_learner(learner uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.own_learner_id() is not null and public.own_learner_id() = learner;
$$;

-- --- learners ---------------------------------------------------------------
drop policy if exists "learners read own" on public.learners;
create policy "learners read own"
  on public.learners for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "learners update own" on public.learners;
create policy "learners update own"
  on public.learners for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- --- enrollments: read own; (writes stay service-role/checkout-only) ---------
drop policy if exists "enrollments read own" on public.enrollments;
create policy "enrollments read own"
  on public.enrollments for select to authenticated
  using (public.owns_learner(enrollments.learner_id));

-- --- orders: read own --------------------------------------------------------
drop policy if exists "orders read own" on public.orders;
create policy "orders read own"
  on public.orders for select to authenticated
  using (public.owns_learner(orders.customer_id));

-- --- lesson_progress: full ownership (the player saves completion) -----------
drop policy if exists "lesson_progress read own" on public.lesson_progress;
create policy "lesson_progress read own"
  on public.lesson_progress for select to authenticated
  using (public.owns_learner(lesson_progress.learner_id));

drop policy if exists "lesson_progress write own" on public.lesson_progress;
create policy "lesson_progress write own"
  on public.lesson_progress for insert to authenticated
  with check (public.owns_learner(lesson_progress.learner_id));

drop policy if exists "lesson_progress update own" on public.lesson_progress;
create policy "lesson_progress update own"
  on public.lesson_progress for update to authenticated
  using (public.owns_learner(lesson_progress.learner_id))
  with check (public.owns_learner(lesson_progress.learner_id));

-- 5. account readability of what they bought ----------------------------------
-- A signed-in buyer can view published courses; lesson content (modules/
-- lessons) readable only inside owned enrollments, so course media never
-- leaks to non-buyers browsing while signed in.

drop policy if exists "courses readable by buyers" on public.courses;
create policy "courses readable by buyers"
  on public.courses for select to authenticated
  using (is_published = true);

drop policy if exists "modules readable by enrolled" on public.modules;
create policy "modules readable by enrolled"
  on public.modules for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = modules.course_id
        and e.learner_id = public.own_learner_id()
    )
  );

drop policy if exists "lessons readable by enrolled" on public.lessons;
create policy "lessons readable by enrolled"
  on public.lessons for select to authenticated
  using (
    exists (
      select 1
      from public.modules m
      join public.enrollments e on e.course_id = m.course_id
      where m.id = lessons.module_id
        and e.learner_id = public.own_learner_id()
    )
  );

-- 6. signed-in buyers may upload quiz_attempts on their own rows --------------
-- (player currently writes through the service role; this future-proofs it)
drop policy if exists "quiz_attempts insert own" on public.quiz_attempts;
create policy "quiz_attempts insert own"
  on public.quiz_attempts for insert to authenticated
  with check (public.owns_learner(quiz_attempts.learner_id));

-- 7. grants so the policies are actually reachable ----------------------------
grant select on public.learners to authenticated;
grant update (email) on public.learners to authenticated;
grant select, insert, update on public.enrollments to authenticated;
grant select on public.orders to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
grant select on public.modules, public.lessons to authenticated;
grant select on public.courses to authenticated;
grant insert on public.quiz_attempts to authenticated;
