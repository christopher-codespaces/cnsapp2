-- CNS Creator OS — Phase 2: public creator profiles + drift guards + public subscribe
-- 2026-09-04
--
-- Applies to the live CNSPLATFORM project. The initial local migration file
-- predates the hardening that was applied directly to the live project
-- (is_own_* helpers, unique landing-page slugs, etc.), so everything below is
-- written to be safe to apply against EITHER state:
--   * Views use CREATE OR REPLACE (idempotent).
--   * The unique-slug constraint is added only when not already present.
--   * Policies are new and not present in the initial migration.

-- =============================================================================
-- 1. PUBLIC CREATOR PROFILES VIEW
-- =============================================================================
-- Public /c/[handle] and /lp/[handle]/[slug] pages need creator branding but
-- the creators table is fully private under RLS. This plain view runs with
-- definer rights (the default, non-security-invoker semantics) so anonymous
-- visitors can read ONLY these curated columns, never the private ones.
--
-- `id` is intentionally included: public pages must resolve handle -> creator_id
-- to fetch published storefronts/landing pages. creator_id is already visible to
-- the public on published storefront/landing_page rows, so this leaks nothing new.
create or replace view public.public_creator_profiles as
select
  id,
  handle,
  brand_name,
  logo_url
from public.creators;

comment on view public.public_creator_profiles is
  'Curated, publicly readable creator identity for /c/[handle] and /lp/[handle]/[slug]. Not backed by RLS policies of its own - definer view over the private creators table.';

grant select on public.public_creator_profiles to anon, authenticated;

-- =============================================================================
-- 2. LANDING PAGE SLUGS UNIQUE PER CREATOR (drift guard)
-- =============================================================================
-- The app surfaces friendly errors for duplicate slugs, so the DB constraint
-- must exist. The local initial migration predates it; add only if a unique
-- constraint covering exactly (creator_id, slug) is not already present.
do $$
declare
  col_attnums smallint[];
begin
  select array_agg(attnum)
    into col_attnums
    from pg_attribute
   where attrelid = 'public.landing_pages'::regclass
     and attname in ('creator_id', 'slug');

  if not exists (
    select 1
      from pg_constraint c
     where c.conrelid = 'public.landing_pages'::regclass
       and c.contype = 'u'
       and c.conkey @> col_attnums
       and c.conkey <@ col_attnums
  ) then
    alter table public.landing_pages
      add constraint landing_pages_creator_id_slug_key unique (creator_id, slug);
  end if;
end $$;

-- =============================================================================
-- 3. PUBLIC EMAIL CAPTURE (storefront Email Signup section + LP signup forms)
-- =============================================================================
-- Anonymous visitors may insert subscribers ONLY for creators who currently
-- have a published storefront or landing page (i.e. an active public page).
-- They cannot read, update, or delete anything, and the "creators read own"
-- policy still governs creator access.
create policy "Subscribers: public can subscribe to published pages"
  on public.subscribers for insert
  with check (
    email is not null
    and email <> ''
    and position('@' in email) > 1
    and (
      exists (
        select 1 from public.storefronts s
        where s.creator_id = subscribers.creator_id and s.is_published
      )
      or exists (
        select 1 from public.landing_pages lp
        where lp.creator_id = subscribers.creator_id and lp.is_published
      )
    )
  );
