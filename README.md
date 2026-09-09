# CNS Creator OS

AI-first, all-in-one platform for creators to build, launch, sell, and teach — storefront,
landing pages, brand kit today; AI Workspace, products/courses, payments, and analytics next.

Stack: Next.js 16 (App Router, TypeScript strict) · Tailwind v4 + shadcn/ui · Supabase
(Postgres + RLS + Auth) · Craft.js drag-and-drop canvas for the landing page editor ·
Anthropic API (server-side only) for the AI workspace · hosted on Vercel.

Build progress lives in [`changes.txt`](./changes.txt).

## Setup

```bash
npm install
cp .env.example .env   # then fill in Supabase URL + anon key
npm run dev
```

The Supabase project is **CNSPLATFORM** (`xysbcnkkllwacvqoumzh`, region `eu-west-1`). The
initial schema is `supabase/migrations/20260903000000_init_schema.sql`; hardening applied
directly to the live project may not be reflected locally, so prefer pulling current state
from the project over re-applying.

### Apply the pending migrations

The migrations below could not be applied from this checkout in the build session (no live
DB write access then). Run them against the live project via the Supabase CLI, dashboard SQL
editor, or Supabase MCP:

**Bring the database online** — one consolidated script replaces all earlier migration
files (they're kept in `supabase/migrations_legacy/` for reference). Either:

- paste the contents of `supabase/migrations/20260909000010_consolidated_fix.sql` into the
  Supabase SQL Editor and Run, or
- from the terminal: `supabase link --project-ref <ref>` then `supabase db push`
  (plain `db push`, no `-f` — it applies everything in `supabase/migrations/`, which is now
  exactly the one consolidated script).

Then re-save your Brand Kit once — the creator row only inserts once RLS is repaired.

Historical per-phase migrations (for fresh projects needing the full trail):
# Phase 2 — public creator profiles view, landing-page slug uniqueness, public subscribe
supabase db push -f supabase/migrations/20260904000000_phase2_public_profiles.sql
# Phase 3 — public read of published products/courses, one storefront per creator
supabase db push -f supabase/migrations/20260905000000_phase3_catalog.sql
# Phase 4 — modules/lessons RLS + storage buckets/policies (uploads, course videos)
supabase db push -f supabase/migrations/20260906000000_phase4_courses_storage.sql
# Phase 4 AI workspace — ai_conversations / ai_messages RLS
supabase db push -f supabase/migrations/20260907000000_ai_workspace.sql
# Course lesson files — private course-files bucket (read-only PDFs)
supabase db push -f supabase/migrations/20260908000000_course_files.sql
# Phase 5+6 — commerce + student access + analytics (orders RLS repair, learners/
enrollments/progress/quiz tables, public page_view/signup events)
supabase db push -f supabase/migrations/20260909000000_phase5_6_commerce.sql
```

Run them **in order** — Phase 3 repairs `courses` RLS, which Phase 4's module/lesson
policies read against; and Phase 4 creates the storage buckets/uploads that the builders'
upload buttons depend on.

Both are written to be safe against either the initial local schema or the live hardened
schema (guards use existence checks; views use `create or replace`).

> Heads-up from live diagnostics: the live project was hardened beyond the local migration
> files (`is_own_*` helper functions back the RLS policies). The local `supabase/migrations/`
> directory predates that hardening — re-sync it from the project when you have CLI access.
> Also note the service role currently lacks `EXECUTE` on those helpers (and does not appear
> to bypass RLS on this project), so service-role reads of
> `storefronts`/`landing_pages`/`products`/`courses`/`subscribers` fail with “permission
> denied for function is_own_creator” while `creators` reads come back empty (RLS-filtered).
> Worth fixing alongside the re-sync if you plan server-side service-role access later.

## Manual verification (Phase 2 checklist)

1. Sign up, set brand name + handle in **Brand Kit**.
2. Build and **publish** a storefront → open `/c/{handle}` **logged out**: branding + sections
   render; check the browser that the page is read-only (no editor controls; Supabase RLS
   blocks writes).
3. Create + **publish** a landing page → open `/lp/{handle}/{slug}` logged out.
4. Create + **publish** a product and a course → they appear as cards in the storefront's
   Products / Courses sections (requires the Phase 3 migration for anonymous reads).
5. Try an unknown handle / unpublished page → expect a 404.
6. Submit the email-capture form on a live page → row lands in `subscribers`, visible to the
   creator, not to anonymous visitors.
7. In the storefront builder, enable **Video (VSL)**, paste a Loom share link + upload a
   thumbnail, and add a testimonial with an uploaded result image/video → the preview plays
   in place (16:9, no letterbox bars) on click, same on the public page.
8. Open a course → **Outline**: drag the ⋮⋮ handle to reorder modules/lessons, add a lesson,
   upload its video (private `course-videos` bucket), and confirm the owner-only preview
   plays; then toggle **Published** in Settings and check the card on `/c/{handle}`.

Uploads land in Supabase Storage (public: `uploads`; private: `course-videos`). Requires the
Phase 4 migration for buckets + policies; course-video uploads accept up to 2 GB per file.

If a storefront save fails, the builder now reports the full server error inline (and to the
console) instead of swallowing it — paste that error when reporting issues.

## Routes

| Route | Purpose |
| --- | --- |
| `/` · `/login` · `/signup` | Landing + auth |
| `/dashboard` | Overview |
| `/dashboard/storefront` | Storefront visual builder (11 sections incl. video VSL, live preview, publish) |
| `/dashboard/products` (+ `/products/[id]`) | Product CRUD (type, price, cover, file) |
| `/dashboard/courses` (+ `/courses/[id]`) | Course list + Kajabi-style builder (Outline: modules/lessons, drag-reorder, video + read-only PDF + quiz per lesson, explicit Save · Settings: price, cover, publish) |
| `/dashboard/ai` | AI workspace — an agent that READS and EDITS your workspace: storefront copy, brand kit, products, courses (full curricula + quizzes), landing pages |
| `/api/ai/chat` | Server route: OpenRouter tool-use agent loop (free models by default), streams NDJSON events (text + tool activity), persists conversations |
| `lib/ai-tools.ts` | The AI's 7 server-side tools; creator-scoped, drafts by default, no deletes |
| `/dashboard/orders` | Creator sales list: paid/pending orders, revenue totals, buyer emails |
| `/orders` | **Buyer** dashboard: email-gated order history across all creators + open purchased courses |
| `/auth/buyer` | Buyer sign-in / create-account (Supabase auth); `?next=` returns to the storefront |
| `/account` | Signed-in buyer dashboard: their courses + order history across every creator |
| `/dashboard/analytics` | Views / signups / enrollments / sales for the last 30 days |
| `/c/[handle]` buy cards | Buy buttons on published products & courses → Paystack checkout (email = the student's access credential) |
| `/api/checkout` | Validates published items, seeds a pending order, initializes a Paystack transaction; free items enroll instantly |
| `/api/paystack/webhook` | HMAC-verified charge.success fulfillment: order → paid, enrollment, sale analytics event |
| `/api/paystack/verify` | Callback-time verification + fulfillment fallback (localhost dev) |
| `/thanks` | Post-purchase confirmation with an "Open your course" CTA |
| `/learn` | Student course player — email-gated: curriculum, video, notes, read-only PDF, graded quizzes, progress |
| `/dashboard/landing-pages` (+ `/landing-pages/[id]`) | Landing page list + block editor |
| `/dashboard/brand-kit` | Canva-style brand board: live preview canvas, color swatches, font presets, voice/audience (reused by the AI when writing copy) |
| `/c/[handle]` · `/lp/[handle]/[slug]` | Public storefront / landing page (server-rendered) |

## jsonb content contract

`types/blocks.ts` documents the shapes the builders write and the Phase 4/5 AI will generate:

- `storefronts.sections` → 11 fixed sections keyed by name (hero, vsl, about, products, courses,
  testimonials, faq, email_signup, social_links, contact, footer; order from
  `STOREFRONT_SECTION_ORDER`). The vsl section embeds a Loom/YouTube/Vimeo link behind an
  optional poster thumbnail; testimonial items can carry a result image and/or video.
- `landing_pages.content` → `{ blocks: [...] }` (heading, text, image, cta_button, testimonial,
  faq, signup_form, spacer).
- `lessons.content` → `{ description?, material? }` where material is `{ kind: "pdf", url }
  (private course-files object path) or `{ kind: "quiz", questions: [...] }` — see
  `types/course.ts`. Quizzes are graded server-side (`/api/course-access` action
  `quiz-grade`); correct answers never ship to the browser.

Normalizers tolerate partial/legacy/AI-shaped rows, so renderers never crash on bad jsonb.

The landing page editor uses a Craft.js drag-and-drop canvas (`@craftjs/core`) on top of this
contract: `lib/craft.ts` converts `Block[]` ↔ craft node trees, so storage and the public
renderer (`components/landing/LpRenderer.tsx`) never see craft internals. Add/edit content in
the canvas or the “Edit” panel; reorder by dragging the ≡ handle or using arrows.

## Quality gates

```bash
npm run build   # TypeScript strict + all routes compile
npm run lint
```
# cnsapp2
