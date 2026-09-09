-- ============================================================================
-- CNS Creator OS — post-push privilege repair (idempotent)
-- 2026-09-09
--
-- After the consolidated push, two things were observed missing on the live
-- project: storage buckets not provisioned, and the service role (used by the
-- checkout/webhook/course-access APIs) lacking table privileges on the new
-- student tables. GRANT/REVOKE statements are idempotent, so this file is
-- safe to push or paste repeatedly.
-- ============================================================================

-- 1. Schema usage -----------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- 2. Buckets (re-run; no-op when present) ------------------------------------
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

-- 3. Public app tables -------------------------------------------------------
-- anon: read published content + insert events/subscribers (RLS still gates).
grant select on public.public_creator_profiles to anon, authenticated;
grant select on public.storefronts, public.landing_pages, public.products, public.courses
  to anon, authenticated;
grant insert on public.analytics_events, public.subscribers to anon, authenticated;

-- authenticated creators: full CRUD on their own rows (RLS scopes them).
grant select, insert, update, delete on
  public.creators, public.storefronts, public.landing_pages,
  public.products, public.courses, public.modules, public.lessons,
  public.ai_conversations, public.ai_messages, public.analytics_events
  to authenticated;

-- orders: authenticated read-only (writes are service-role only).
grant select on public.orders to authenticated;

-- 4. Service role: full access to everything (checkout, webhook, access API) -
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Belt-and-braces: functions must be executable by the roles that need them
-- (the original live bug was missing EXECUTE on is_own_* helpers).
grant execute on all functions in schema public to anon, authenticated, service_role;

-- 5. Keep student tables locked down from browser roles ----------------------
revoke all on public.learners, public.enrollments, public.lesson_progress, public.quiz_attempts
  from anon, authenticated;

-- 6. Future tables created by migrations get service_role grants by default --
do $$ begin
  alter default privileges in schema public grant all on tables to service_role;
exception when others then null;
end $$;
do $$ begin
  alter default privileges in schema public grant all on sequences to service_role;
exception when others then null;
end $$;
