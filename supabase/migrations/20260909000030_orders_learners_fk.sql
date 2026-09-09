-- ============================================================================
-- CNS Creator OS — orders → learners FK repair (idempotent)
-- 2026-09-09
--
-- The base schema pointed orders.customer_id at public.customers (the original
-- per-creator customer concept). The platform's buyers are now learners
-- (email-unique students created at checkout), so checkout/fulfillment write
-- learner ids into orders.customer_id — which violated the old FK and made
-- every order insert fail. Repoint the constraint; the table is empty so no
-- data migration is needed.
-- ============================================================================

do $$
declare
  refs text;
begin
  select coalesce(confrelid::regclass::text, '') into refs
    from pg_constraint
   where conname = 'orders_customer_id_fkey'
     and conrelid = 'public.orders'::regclass;

  if refs is distinct from 'public.learners' then
    alter table public.orders drop constraint if exists orders_customer_id_fkey;
    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key (customer_id) references public.learners(id) on delete cascade;
  end if;
end $$;
