-- CNS Creator OS — Initial Schema Migration
-- All tables use UUID primary keys, RLS enabled, scoped to auth.uid()

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- Creators (maps 1:1 to auth.users)
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  handle text unique not null,
  brand_name text not null,
  brand_colors jsonb default '{}'::jsonb,
  logo_url text,
  fonts jsonb default '{}'::jsonb,
  tone_of_voice text,
  target_audience text,
  preferred_cta text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Storefronts
create table public.storefronts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  sections jsonb default '{}'::jsonb not null,
  is_published boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Landing Pages
create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  slug text not null,
  type text not null check (type in ('sales','webinar','lead_magnet','waitlist','thank_you','vsl','launch')),
  content jsonb default '{}'::jsonb not null,
  is_published boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Digital Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  type text not null check (type in ('pdf','ebook','template','canva','notion','zip','audio','membership')),
  title text not null,
  description text,
  price_cents integer default 0 not null,
  cover_image_url text,
  file_url text,
  is_published boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  title text not null,
  description text,
  cover_image_url text,
  price_cents integer default 0 not null,
  is_published boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Modules (belong to courses)
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  position integer not null
);

-- Lessons (belong to modules)
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade not null,
  title text not null,
  position integer not null,
  content jsonb default '{}'::jsonb,
  video_url text
);

-- Customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  creator_id uuid references public.creators(id) on delete cascade not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  amount_cents integer not null,
  status text not null check (status in ('pending','paid','refunded')) default 'pending',
  stripe_payment_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Subscribers
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  email text not null,
  source text references public.landing_pages(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Lesson Progress
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  completed_at timestamptz default now() not null,
  unique(customer_id, lesson_id)
);

-- AI Conversations
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  title text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- AI Messages
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  tool_calls jsonb default '[]'::jsonb,
  created_at timestamptz default now() not null
);

-- AI Assets (generated by AI, browsable/reusable)
create table public.ai_assets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  type text not null check (type in ('landing_page','storefront_layout','product_description','email_copy','course_outline','worksheet','pdf')),
  reference_id text,
  content jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Analytics Events
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  event_type text not null check (event_type in ('page_view','sale','signup','enrollment')),
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

-- =============================================================================
-- TIMESTAMPS HELPER
-- =============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger updated_at on all creator-owned tables
create trigger creators_updated_at before update on public.creators
  for each row execute function public.handle_updated_at();
create trigger storefronts_updated_at before update on public.storefronts
  for each row execute function public.handle_updated_at();
create trigger landing_pages_updated_at before update on public.landing_pages
  for each row execute function public.handle_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.handle_updated_at();
create trigger courses_updated_at before update on public.courses
  for each row execute function public.handle_updated_at();
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.handle_updated_at();
create trigger ai_assets_updated_at before update on public.ai_assets
  for each row execute function public.handle_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.creators enable row level security;
alter table public.storefronts enable row level security;
alter table public.landing_pages enable row level security;
alter table public.products enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.subscribers enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_assets enable row level security;
alter table public.analytics_events enable row level security;

-- Helper: resolve creator row to current auth user
create or replace function public.creator_id()
returns uuid as $$
  select auth.uid()::uuid;
$$ language sql security definer stable;

-- =============================================================================
-- CREATOR-OWNED TABLE POLICIES
-- (creator can crud their own rows where creator_id == auth.uid())
-- =============================================================================

-- creators
create policy "Creators can read their own row" on public.creators for select
  using (auth.uid() = user_id);
create policy "Creators can insert their own row" on public.creators for insert
  with check (auth.uid() = user_id);
create policy "Creators can update their own row" on public.creators for update
  using (auth.uid() = user_id);
create policy "Creators can delete their own row" on public.creators for delete
  using (auth.uid() = user_id);

-- storefronts
create policy "Storefronts: creators read own" on public.storefronts for select
  using (auth.uid() = creator_id);
create policy "Storefronts: creators insert own" on public.storefronts for insert
  with check (auth.uid() = creator_id);
create policy "Storefronts: creators update own" on public.storefronts for update
  using (auth.uid() = creator_id);
create policy "Storefronts: creators delete own" on public.storefronts for delete
  using (auth.uid() = creator_id);

-- landing_pages
create policy "Landing pages: creators read own" on public.landing_pages for select
  using (auth.uid() = creator_id);
create policy "Landing pages: creators insert own" on public.landing_pages for insert
  with check (auth.uid() = creator_id);
create policy "Landing pages: creators update own" on public.landing_pages for update
  using (auth.uid() = creator_id);
create policy "Landing pages: creators delete own" on public.landing_pages for delete
  using (auth.uid() = creator_id);

-- products
create policy "Products: creators read own" on public.products for select
  using (auth.uid() = creator_id);
create policy "Products: creators insert own" on public.products for insert
  with check (auth.uid() = creator_id);
create policy "Products: creators update own" on public.products for update
  using (auth.uid() = creator_id);
create policy "Products: creators delete own" on public.products for delete
  using (auth.uid() = creator_id);

-- courses
create policy "Courses: creators read own" on public.courses for select
  using (auth.uid() = creator_id);
create policy "Courses: creators insert own" on public.courses for insert
  with check (auth.uid() = creator_id);
create policy "Courses: creators update own" on public.courses for update
  using (auth.uid() = creator_id);
create policy "Courses: creators delete own" on public.courses for delete
  using (auth.uid() = creator_id);

-- modules (inherits course ownership)
create policy "Modules: creators read own courses" on public.modules for select
  using (exists (select 1 from public.courses where id = course_id and creator_id = auth.uid()));
create policy "Modules: creators insert own courses" on public.modules for insert
  with check (exists (select 1 from public.courses where id = course_id and creator_id = auth.uid()));
create policy "Modules: creators update own courses" on public.modules for update
  using (exists (select 1 from public.courses where id = course_id and creator_id = auth.uid()));
create policy "Modules: creators delete own courses" on public.modules for delete
  using (exists (select 1 from public.courses where id = course_id and creator_id = auth.uid()));

-- lessons (inherits course ownership)
create policy "Lessons: creators read own courses" on public.lessons for select
  using (exists (select 1 from public.courses c join public.modules m on m.course_id = c.id where m.id = lesson_id and c.creator_id = auth.uid()));
create policy "Lessons: creators insert own courses" on public.lessons for insert
  with check (exists (select 1 from public.courses c join public.modules m on m.course_id = c.id where m.id = module_id and c.creator_id = auth.uid()));
create policy "Lessons: creators update own courses" on public.lessons for update
  using (exists (select 1 from public.courses c join public.modules m on m.course_id = c.id where m.id = module_id and c.creator_id = auth.uid()));
create policy "Lessons: creators delete own courses" on public.lessons for delete
  using (exists (select 1 from public.courses c join public.modules m on m.course_id = c.id where m.id = module_id and c.creator_id = auth.uid()));

-- customers
create policy "Customers: creators read own" on public.customers for select
  using (auth.uid() = creator_id);
create policy "Customers: creators insert own" on public.customers for insert
  with check (auth.uid() = creator_id);
create policy "Customers: creators update own" on public.customers for update
  using (auth.uid() = creator_id);
create policy "Customers: creators delete own" on public.customers for delete
  using (auth.uid() = creator_id);

-- orders: creator can read their own customers' orders
create policy "Orders: creators read own customer orders" on public.orders for select
  using (exists (select 1 from public.customers where id = customer_id and creator_id = auth.uid()));
create policy "Orders: creators insert own customer orders" on public.orders for insert
  with check (exists (select 1 from public.customers where id = customer_id and creator_id = auth.uid()));
create policy "Orders: creators update own customer orders" on public.orders for update
  using (exists (select 1 from public.customers where id = customer_id and creator_id = auth.uid()));
create policy "Orders: creators delete own customer orders" on public.orders for delete
  using (exists (select 1 from public.customers where id = customer_id and creator_id = auth.uid()));

-- subscribers
create policy "Subscribers: creators read own" on public.subscribers for select
  using (auth.uid() = creator_id);
create policy "Subscribers: creators insert own" on public.subscribers for insert
  with check (auth.uid() = creator_id);
create policy "Subscribers: creators delete own" on public.subscribers for delete
  using (auth.uid() = creator_id);

-- lesson_progress: customer can read own progress
create policy "Lesson progress: customers read own" on public.lesson_progress for select
  using (exists (select 1 from public.customers where id = customer_id and creator_id = auth.uid()));
create policy "Lesson progress: customers insert own" on public.lesson_progress for insert
  with check (exists (select 1 from public.customers where id = customer_id and creator_id = auth.uid()));
create policy "Lesson progress: customers delete own" on public.lesson_progress for delete
  using (exists (select 1 from public.customers where id = customer_id and creator_id = auth.uid()));

-- ai_conversations
create policy "AI conversations: creators read own" on public.ai_conversations for select
  using (auth.uid() = creator_id);
create policy "AI conversations: creators insert own" on public.ai_conversations for insert
  with check (auth.uid() = creator_id);
create policy "AI conversations: creators update own" on public.ai_conversations for update
  using (auth.uid() = creator_id);
create policy "AI conversations: creators delete own" on public.ai_conversations for delete
  using (auth.uid() = creator_id);

-- ai_messages
create policy "AI messages: creators read own conversations" on public.ai_messages for select
  using (exists (select 1 from public.ai_conversations where id = conversation_id and creator_id = auth.uid()));
create policy "AI messages: creators insert own conversations" on public.ai_messages for insert
  with check (exists (select 1 from public.ai_conversations where id = conversation_id and creator_id = auth.uid()));
create policy "AI messages: creators delete own conversations" on public.ai_messages for delete
  using (exists (select 1 from public.ai_conversations where id = conversation_id and creator_id = auth.uid()));

-- ai_assets
create policy "AI assets: creators read own" on public.ai_assets for select
  using (auth.uid() = creator_id);
create policy "AI assets: creators insert own" on public.ai_assets for insert
  with check (auth.uid() = creator_id);
create policy "AI assets: creators update own" on public.ai_assets for update
  using (auth.uid() = creator_id);
create policy "AI assets: creators delete own" on public.ai_assets for delete
  using (auth.uid() = creator_id);

-- analytics_events
create policy "Analytics events: creators read own" on public.analytics_events for select
  using (auth.uid() = creator_id);
create policy "Analytics events: creators insert own" on public.analytics_events for insert
  with check (auth.uid() = creator_id);

-- =============================================================================
-- CUSTOMER-PORTAL POLICIES
-- (logged-in customer can read only their own orders, progress, customers)
-- =============================================================================

-- Orders: customers can read their own orders (via auth.uid on customers.auth_user_id)
create policy "Orders: customers read own" on public.orders for select
  using (exists (
    select 1 from public.customers
    where id = customer_id and auth_user_id = auth.uid()
  ));

-- Lesson progress: customers can read their own progress
create policy "Lesson progress: customers read own" on public.lesson_progress for select
  using (exists (
    select 1 from public.customers
    where id = customer_id and auth_user_id = auth.uid()
  ));

-- Customers: customers can read their own customer row
create policy "Customers: customers read own" on public.customers for select
  using (auth_user_id = auth.uid());

-- =============================================================================
-- PUBLIC READ POLICIES (for storefronts, landing pages that are published)
-- =============================================================================

-- Published storefronts are publicly readable
create policy "Storefronts: published readable by anyone" on public.storefronts for select
  using (is_published = true);

-- Published landing pages are publicly readable
create policy "Landing pages: published readable by anyone" on public.landing_pages for select
  using (is_published = true);

-- =============================================================================
-- ANALYTICS EVENTS (insert from server-side, not client)
-- =============================================================================

create policy "Analytics events: insert via service role" on public.analytics_events for insert
  with check (true);