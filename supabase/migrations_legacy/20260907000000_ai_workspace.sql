-- CNS Creator OS — AI Workspace (Phase 4): conversation/message RLS repair
-- 2026-09-07
--
-- The live project backs its creator policies with is_own_conversation() /
-- is_own_creator() helper functions that lack EXECUTE grants for the roles
-- that need them, so the AI workspace's conversation CRUD would fail with
-- "permission denied for function is_own_conversation".
--
-- Repair: drop ALL policies on ai_conversations + ai_messages and recreate
-- them with explicit TO authenticated and plain subqueries (no helper
-- dependency), matching the Phase 3/4 repairs. Idempotent (drop-all-then-
-- create). Apply AFTER the Phase 4 courses/storage migration (the subqueries
-- read public.creators, whose SELECT is already fine for the owner).

do $$
declare
  t text;
  p text;
begin
  foreach t in array array['ai_conversations', 'ai_messages'] loop
    for p in
      select policyname
        from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
  end loop;
end $$;

-- ai_conversations: the creator's own conversations
create policy "owner read own" on public.ai_conversations for select to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = ai_conversations.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner insert own" on public.ai_conversations for insert to authenticated
  with check (exists (
    select 1 from public.creators c
    where c.id = ai_conversations.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner update own" on public.ai_conversations for update to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = ai_conversations.creator_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.creators c
    where c.id = ai_conversations.creator_id and c.user_id = (select auth.uid())
  ));
create policy "owner delete own" on public.ai_conversations for delete to authenticated
  using (exists (
    select 1 from public.creators c
    where c.id = ai_conversations.creator_id and c.user_id = (select auth.uid())
  ));

-- ai_messages: messages inside the creator's own conversations
create policy "owner read own" on public.ai_messages for select to authenticated
  using (exists (
    select 1 from public.ai_conversations ac
    join public.creators c on c.id = ac.creator_id
    where ac.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
  ));
create policy "owner insert own" on public.ai_messages for insert to authenticated
  with check (exists (
    select 1 from public.ai_conversations ac
    join public.creators c on c.id = ac.creator_id
    where ac.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
  ));
create policy "owner update own" on public.ai_messages for update to authenticated
  using (exists (
    select 1 from public.ai_conversations ac
    join public.creators c on c.id = ac.creator_id
    where ac.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.ai_conversations ac
    join public.creators c on c.id = ac.creator_id
    where ac.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
  ));
create policy "owner delete own" on public.ai_messages for delete to authenticated
  using (exists (
    select 1 from public.ai_conversations ac
    join public.creators c on c.id = ac.creator_id
    where ac.id = ai_messages.conversation_id and c.user_id = (select auth.uid())
  ));