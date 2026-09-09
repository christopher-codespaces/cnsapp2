-- CNS Creator OS — Phase 3: Catalog (products + courses) public reads + storefront guard
-- + RLS drift repair (reads AND writes) for the four public-facing creator tables
-- 2026-09-05
--
-- Safe to apply against either the initial local schema or the live (hardened)
-- schema: guards use existence checks and policy names are recreated from
-- scratch each run (drop-all then create), so this is idempotent.

-- =============================================================================
-- 1. STOREFRONT UNIQUENESS (drift guard)
-- =============================================================================
-- One storefront per creator. The app saves with insert-or-update-by-id (no ON
-- CONFLICT dependency), but this enforces the invariant. Added only when no
-- unique constraint already covers creator_id.
do $$
declare
  col_attnums smallint[];
begin
  select array_agg(attnum)
    into col_attnums
    from pg_attribute
   where attrelid = 'public.storefronts'::regclass
     and attname = 'creator_id';

  if not exists (
    select 1
      from pg_constraint c
     where c.conrelid = 'public.storefronts'::regclass
       and c.contype = 'u'
       and c.conkey @> col_attnums
       and c.conkey <@ col_attnums
  ) then
    alter table public.storefronts
      add constraint storefronts_creator_id_key unique (creator_id);
  end if;
end $$;

-- =============================================================================
-- 2. RLS DRIFT REPAIR — reads AND writes for creator-owned public tables
-- =============================================================================
-- The live project backs its creator policies with is_own_creator() helper
-- functions, but those helpers are not granted EXECUTE to the roles that need
-- them, so real-world behavior breaks:
--   * anon        -> "permission denied for function is_own_creator" even when
--                    reading published rows (all policies on a table are
--                    evaluated for the querying role)
--   * authenticated -> same error on INSERT/UPDATE/DELETE (their own rows),
--                    e.g. the storefront builder's save
--   * service role -> same error (does not bypass RLS on this project)
--
-- Repair: rebuild ALL policies on the four tables the public-facing routes and
-- the builder/catalog UIs touch — storefronts, landing_pages, products,
-- courses — with explicit TO roles and NO helper-function dependency:
--   * anon/authenticated SELECT published rows only (plain is_published check)
--   * authenticated full CRUD on own rows via a plain subquery against
--     creators (creators.id = <table>.creator_id AND creators.user_id =
--     auth.uid()). The subquery is itself subject to creators' RLS, so it can
--     never leak another creator's rows.
--
-- Drop-all-then-create is idempotent and works whether the table carries the
-- local (owner-only) policies, the live (helper-based) policies, or both.
do $$
declare
  t text;
  p text;
begin
  foreach t in array array['storefronts', 'landing_pages', 'products', 'courses'] loop
    for p in
      select policyname
        from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- Public read: published rows only.
create policy "public read published"
  on public.storefronts for select to anon, authenticated
  using (is_published = true);
create policy "public read published"
  on public.landing_pages for select to anon, authenticated
  using (is_published = true);
create policy "public read published"
  on public.products for select to anon, authenticated
  using (is_published = true);
create policy "public read published"
  on public.courses for select to anon, authenticated
  using (is_published = true);

-- Owner CRUD: the creator's own rows, via creators.user_id = auth.uid().
-- (A helper function is intentionally avoided — the live helper lacks EXECUTE
-- grants for these roles, which is the bug being repaired.)

create policy "owner read own"
  on public.storefronts for select to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = storefronts.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner insert own"
  on public.storefronts for insert to authenticated
  with check (exists (
    select 1 from public.creators c
    where c.id = storefronts.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner update own"
  on public.storefronts for update to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = storefronts.creator_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.creators c
    where c.id = storefronts.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner delete own"
  on public.storefronts for delete to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = storefronts.creator_id and c.user_id = (select auth.uid())
  ));

create policy "owner read own"
  on public.landing_pages for select to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = landing_pages.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner insert own"
  on public.landing_pages for insert to authenticated
  with check (exists (
    select 1 from public.creators c
    where c.id = landing_pages.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner update own"
  on public.landing_pages for update to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = landing_pages.creator_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.creators c
    where c.id = landing_pages.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner delete own"
  on public.landing_pages for delete to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = landing_pages.creator_id and c.user_id = (select auth.uid())
  ));

create policy "owner read own"
  on public.products for select to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = products.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner insert own"
  on public.products for insert to authenticated
  with check (exists (
    select 1 from public.creators c
    where c.id = products.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner update own"
  on public.products for update to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = products.creator_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.creators c
    where c.id = products.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner delete own"
  on public.products for delete to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = products.creator_id and c.user_id = (select auth.uid())
  ));

create policy "owner read own"
  on public.courses for select to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = courses.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner insert own"
  on public.courses for insert to authenticated
  with check (exists (
    select 1 from public.creators c
    where c.id = courses.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner update own"
  on public.courses for update to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = courses.creator_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.creators c
    where c.id = courses.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner delete own"
  on public.courses for delete to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = courses.creator_id and c.user_id = (select auth.uid())
  ));
