// =============================================================================
// CNS Creator OS — AI tool layer (write access for the workspace chat)
// -----------------------------------------------------------------------------
// The workspace chat model can call these tools; every execution happens
// SERVER-SIDE against the signed-in creator's own rows (creator_id is taken
// from the session, never from the model). Schemas are OpenAI-style
// JSON-schema function tools (OpenRouter-compatible); `executeTool` is the
// only mutation path.
//
// Guardrails:
//  - every write is scoped by the session's creator_id;
//  - publication flags default to false (the AI drafts, the human publishes);
//  - no delete tools.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STOREFRONT_SECTION_ORDER,
  normalizeStorefrontSections,
  defaultStorefrontSections,
  makeBlock,
  type Block,
  type BlockType,
  type StorefrontSectionKey,
} from "@/types/blocks";
import { makeQuizQuestion, normalizeLessonMaterial } from "@/types/course";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface AiTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type Json = Record<string, unknown>;

export type ToolResult =
  | { ok: true; summary: string; data?: Json }
  | { ok: false; error: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
/** The hand-rolled Database type lacks Relationships keys; all queries here
 *  go through `any` on purpose. Returns { data, error } minimally typed. */
function q<T = unknown>(p: any): Promise<{ data: T | null; error: { message: string } | null }> {
  return p;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ */
/* Tool schemas                                                        */
/* ------------------------------------------------------------------ */

const Str = { type: "string" } as const;

const SECTION_KEYS = STOREFRONT_SECTION_ORDER as unknown as string[];
const EDITABLE_SECTIONS = SECTION_KEYS.filter((k) => k !== "products" && k !== "courses");

export const AI_TOOLS: AiTool[] = [
  {
    name: "get_workspace",
    description:
      "Read the creator's current workspace: brand kit, storefront sections (with all copy), products, courses (with full module/lesson outline, lesson notes and quiz info), and landing pages. Call this first whenever the request depends on current content.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_brand_kit",
    description:
      "Update the creator's brand kit: brand name, handle (URL slug /c/<handle>), tone of voice, target audience, preferred CTA text, brand colors (hex) and font choices.",
    input_schema: {
      type: "object",
      properties: {
        brand_name: { ...Str, description: "Business / brand name" },
        handle: { ...Str, description: "URL handle, lowercase letters/numbers/dashes only" },
        tone_of_voice: { ...Str, description: "How the brand sounds, e.g. 'warm, no-hype, coach-like'" },
        target_audience: { ...Str, description: "Who the brand serves" },
        preferred_cta: { ...Str, description: "Favorite call-to-action phrase, e.g. 'Start today'" },
        color_primary: { ...Str, description: "Primary brand color as #RRGGBB" },
        color_secondary: { ...Str, description: "Secondary brand color as #RRGGBB" },
        color_accent: { ...Str, description: "Accent brand color as #RRGGBB" },
        font_display: { ...Str, description: "Display/heading font name" },
        font_body: { ...Str, description: "Body font name" },
      },
    },
  },
  {
    name: "update_storefront_section",
    description:
      "Write content into one storefront section. Provide the field values for that section (merged shallowly; existing fields not mentioned are kept). Sections: " +
      EDITABLE_SECTIONS.join(", ") +
      ". For hero use headline/subheadline/cta_primary{label,href}/cta_secondary/badge/image_url/align. For about use heading/body/image_url. For vsl use heading/subheadline/video_url/thumbnail_url/cta_label/cta_href. For faq use heading + items[{q,a}]. For testimonials use heading + items[{quote,author,role,image_url,video_url}]. For email_signup use heading/body/cta_label. For social_links use heading + items[{platform,label,url}]. For contact use heading/body/email. For footer use text.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", enum: EDITABLE_SECTIONS, description: "Which section to edit" },
        fields: {
          type: "object",
          description: "Field values to set, e.g. { \"headline\": \"…\", \"cta_primary\": { \"label\": \"Start\", \"href\": \"\" } }",
        },
        enabled: { type: "boolean", description: "Optionally also show/hide the section" },
      },
      required: ["section", "fields"],
    },
  },
  {
    name: "set_storefront_section_enabled",
    description: "Show (true) or hide (false) any storefront section, including products/courses.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", enum: SECTION_KEYS },
        enabled: { type: "boolean" },
      },
      required: ["section", "enabled"],
    },
  },
  {
    name: "upsert_product",
    description:
      "Create a product, or update an existing one whose title matches (case-insensitive). Digital products shown on the storefront (ebook, template, preset…).",
    input_schema: {
      type: "object",
      properties: {
        title: Str,
        description: { ...Str, description: "Sales description (plain text, line breaks allowed)" },
        price: { type: "number", description: "Price in US dollars (e.g. 27 or 0 for free)" },
        product_type: { ...Str, description: "e.g. ebook, template, preset" },
        file_url: { ...Str, description: "Delivery file URL (private path or external)" },
        publish: { type: "boolean", description: "Publish immediately (default false — drafts for review)" },
      },
      required: ["title"],
    },
  },
  {
    name: "upsert_course",
    description:
      "Create a course, or update an existing one whose title matches (case-insensitive). Pass modules to build or extend the curriculum; new modules/lessons are appended, existing modules are matched by title and extended.",
    input_schema: {
      type: "object",
      properties: {
        title: Str,
        description: Str,
        price: { type: "number", description: "Price in US dollars (0 for free)" },
        publish: { type: "boolean", description: "Publish immediately (default false)" },
        modules: {
          type: "array",
          description: "Curriculum to create/append",
          items: {
            type: "object",
            properties: {
              title: Str,
              lessons: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: Str,
                    notes: { ...Str, description: "Student-facing notes / description" },
                    video_url: { ...Str, description: "External video URL (Loom/YouTube/Vimeo) if available" },
                    quiz: {
                      type: "array",
                      description: "Optional quiz attached to the lesson",
                      items: {
                        type: "object",
                        properties: {
                          prompt: Str,
                          options: { type: "array", items: Str },
                          correct_index: { type: "number", description: "0-based index of the correct option" },
                        },
                        required: ["prompt", "options", "correct_index"],
                      },
                    },
                  },
                  required: ["title"],
                },
              },
            },
            required: ["title"],
          },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "create_landing_page",
    description:
      "Create a new landing page built from blocks rendered top-to-bottom: heading, text, image, cta_button, testimonial, faq, signup_form, spacer.",
    input_schema: {
      type: "object",
      properties: {
        title: { ...Str, description: "Internal name shown in the dashboard" },
        slug: { ...Str, description: "URL slug (lowercase-dashes). Derived from the title when omitted." },
        page_type: {
          type: "string",
          enum: ["sales", "webinar", "lead_magnet", "waitlist", "thank_you", "vsl", "launch"],
          description: "Landing page type (default sales)",
        },
        blocks: {
          type: "array",
          description: "Page content, top to bottom",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["heading", "text", "image", "cta_button", "testimonial", "faq", "signup_form", "spacer"] },
              text: { ...Str, description: "heading: heading text" },
              level: { type: "number", description: "heading: 1–3" },
              body: { ...Str, description: "text: paragraph body" },
              url: { ...Str, description: "image: image URL" },
              alt: Str,
              caption: Str,
              label: { ...Str, description: "cta_button: button label" },
              href: { ...Str, description: "cta_button: link URL" },
              quote: Str,
              author: Str,
              role: Str,
              heading: { ...Str, description: "faq/signup_form: section heading" },
              items: { type: "array", items: { type: "object", properties: { q: Str, a: Str } }, description: "faq: Q&A pairs" },
              cta_label: { ...Str, description: "signup_form: button text" },
              height: { type: "number", description: "spacer: height in px" },
            },
            required: ["type"],
          },
        },
        publish: { type: "boolean", description: "Publish immediately (default false)" },
      },
      required: ["title", "blocks"],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Workspace read (shared by the chat route and get_workspace)          */
/* ------------------------------------------------------------------ */

export async function readWorkspace(supabase: SupabaseClient, creatorId: string): Promise<Json> {
  const [sfRes, prodRes, courseRes, lpRes, creatorRes] = await Promise.all([
    q(supabase.from("storefronts").select("sections, is_published").eq("creator_id", creatorId).maybeSingle()),
    q(supabase.from("products").select("id, title, description, type, price_cents, is_published, file_url").eq("creator_id", creatorId).order("updated_at", { ascending: false }).limit(50)),
    q(supabase.from("courses").select("id, title, description, price_cents, is_published").eq("creator_id", creatorId).order("updated_at", { ascending: false }).limit(50)),
    q(supabase.from("landing_pages").select("id, title, slug, type, is_published").eq("creator_id", creatorId).order("updated_at", { ascending: false }).limit(50)),
    q(supabase.from("creators").select("brand_name, handle, brand_colors, fonts, tone_of_voice, target_audience, preferred_cta, logo_url").eq("id", creatorId).maybeSingle()),
  ]);

  const courses = (courseRes.data ?? []) as unknown as { id: string; title: string; description: string | null; price_cents: number; is_published: boolean }[];
  const courseIds = courses.map((c) => c.id);
  let modules: { id: string; course_id: string; title: string; position: number }[] = [];
  let lessons: { id: string; module_id: string; title: string; video_url: string | null; content: Record<string, unknown> | null; position: number }[] = [];
  if (courseIds.length) {
    const mRes = await q(supabase.from("modules").select("id, course_id, title, position").in("course_id", courseIds).order("position").limit(400));
    modules = (mRes.data ?? []) as typeof modules;
    if (modules.length) {
      const lRes = await q(supabase.from("lessons").select("id, module_id, title, video_url, content, position").in("module_id", modules.map((m) => m.id)).order("position").limit(1200));
      lessons = (lRes.data ?? []) as typeof lessons;
    }
  }

  return {
    brand: creatorRes.data ?? {},
    storefront: {
      is_published: (sfRes.data as unknown as { is_published?: boolean } | null)?.is_published ?? false,
      sections: normalizeStorefrontSections((sfRes.data as unknown as { sections: unknown } | null)?.sections),
    },
    products: prodRes.data ?? [],
    courses: courses.map((c) => ({
      ...c,
      modules: modules
        .filter((m) => m.course_id === c.id)
        .sort((x, y) => x.position - y.position)
        .map((m) => ({
          title: m.title,
          lessons: lessons
            .filter((l) => l.module_id === m.id)
            .sort((x, y) => x.position - y.position)
            .map((l) => {
              const content = (l.content ?? {}) as Json;
              const material = normalizeLessonMaterial(content.material);
              return {
                title: l.title,
                video_url: l.video_url,
                notes: typeof content.description === "string" ? content.description : undefined,
                quiz_questions: material?.kind === "quiz" ? material.questions.length : 0,
                has_pdf: material?.kind === "pdf",
              };
            }),
        })),
    })),
    landing_pages: lpRes.data ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function hex(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
}

/** Load the creator's storefront row, creating one lazily when missing. */
async function ensureStorefront(supabase: SupabaseClient, creatorId: string) {
  const { data: sf } = await q<{ id: string; sections: unknown }>(
    supabase.from("storefronts").select("id, sections").eq("creator_id", creatorId).maybeSingle()
  );
  if (sf) return { id: sf.id as string, sections: normalizeStorefrontSections(sf.sections) };
  const { data: created, error } = await q<{ id: string; sections: unknown }>(
    supabase
      .from("storefronts")
      .insert({ creator_id: creatorId, sections: defaultStorefrontSections(), is_published: false })
      .select("id, sections")
      .single()
  );
  if (error || !created) return null;
  return { id: created.id, sections: normalizeStorefrontSections(created.sections) };
}

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

/**
 * Execute one tool call. `creatorId` always comes from the server session;
 * every write is scoped by it, so the model can never touch other rows.
 */
export async function executeTool(
  supabase: SupabaseClient,
  creatorId: string,
  name: string,
  input: Json
): Promise<ToolResult> {
  try {
    switch (name) {
      case "get_workspace": {
        const data = await readWorkspace(supabase, creatorId);
        return { ok: true, summary: "Loaded the current workspace.", data };
      }

      case "update_brand_kit": {
        const patch: Json = {};
        for (const key of ["brand_name", "tone_of_voice", "target_audience", "preferred_cta"] as const) {
          const v = input[key];
          if (typeof v === "string" && v.trim()) patch[key] = v.trim();
        }
        if (typeof input.handle === "string" && input.handle.trim()) {
          const h = slugify(input.handle);
          if (!h) return { ok: false, error: "Handle must contain letters or numbers." };
          patch.handle = h;
        }
        const { data: current } = await q<{ brand_colors: Json | null; fonts: Json | null }>(
          supabase.from("creators").select("brand_colors, fonts").eq("id", creatorId).maybeSingle()
        );
        const colors = { ...((current?.brand_colors ?? {}) as Json) };
        const fonts = { ...((current?.fonts ?? {}) as Json) };
        for (const [k, slot] of [
          ["color_primary", "primary"],
          ["color_secondary", "secondary"],
          ["color_accent", "accent"],
        ] as const) {
          const c = hex(input[k]);
          if (c) colors[slot] = c;
        }
        if (typeof input.font_display === "string" && input.font_display.trim()) fonts.display = input.font_display.trim();
        if (typeof input.font_body === "string" && input.font_body.trim()) fonts.body = input.font_body.trim();
        if (Object.keys(colors).length) patch.brand_colors = colors;
        if (Object.keys(fonts).length) patch.fonts = fonts;

        if (!Object.keys(patch).length) return { ok: false, error: "No recognizable brand fields provided." };
        const { error } = await q(supabase.from("creators").update(patch).eq("id", creatorId));
        if (error) return { ok: false, error: error.message };
        return { ok: true, summary: `Updated the brand kit: ${Object.keys(patch).join(", ")}.` };
      }

      case "update_storefront_section":
      case "set_storefront_section_enabled": {
        const sf = await ensureStorefront(supabase, creatorId);
        if (!sf) return { ok: false, error: "Could not open the storefront." };
        const sections = sf.sections;

        if (name === "set_storefront_section_enabled") {
          const key = String(input.section) as StorefrontSectionKey;
          if (!SECTION_KEYS.includes(key)) return { ok: false, error: `Unknown section "${input.section}".` };
          sections[key].enabled = Boolean(input.enabled);
        } else {
          const key = String(input.section) as StorefrontSectionKey;
          if (!EDITABLE_SECTIONS.includes(key)) {
            return { ok: false, error: `Section "${input.section}" renders catalog items — use set_storefront_section_enabled for it.` };
          }
          const fields = (input.fields ?? {}) as Json;
          if (!fields || typeof fields !== "object" || !Object.keys(fields).length) {
            return { ok: false, error: "fields must be a non-empty object." };
          }
          const merged = { ...(sections[key] as unknown as Json) };
          for (const [k, v] of Object.entries(fields)) {
            if (k === "enabled") merged.enabled = Boolean(v);
            else if ((k === "cta_primary" || k === "cta_secondary") && v && typeof v === "object") {
              merged[k] = { ...(merged[k] as Json), ...(v as Json) };
            } else if (Array.isArray(v) || typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
              merged[k] = v;
            }
          }
          if (typeof input.enabled === "boolean") merged.enabled = input.enabled;
          (sections as unknown as Json)[key] = merged;
        }

        const { error } = await q(supabase.from("storefronts").update({ sections: sections as unknown as Json }).eq("id", sf.id));
        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          summary:
            name === "set_storefront_section_enabled"
              ? `${input.enabled ? "Enabled" : "Disabled"} the ${input.section} section.`
              : `Updated the ${input.section} section.`,
        };
      }

      case "upsert_product": {
        const title = String(input.title ?? "").trim();
        if (!title) return { ok: false, error: "title is required." };
        const patch: Json = { title };
        if (typeof input.description === "string") patch.description = input.description;
        if (typeof input.price === "number" && input.price >= 0) patch.price_cents = Math.round(input.price * 100);
        if (typeof input.product_type === "string" && input.product_type.trim()) patch.type = input.product_type.trim();
        if (typeof input.file_url === "string" && input.file_url.trim()) patch.file_url = input.file_url.trim();
        if (input.publish !== undefined) patch.is_published = Boolean(input.publish);

        const { data: existing } = await q<{ id: string }[]>(
          supabase.from("products").select("id").eq("creator_id", creatorId).ilike("title", title).limit(1)
        );
        const found = (existing ?? [])[0];
        if (found) {
          const { error } = await q(supabase.from("products").update(patch).eq("id", found.id).eq("creator_id", creatorId));
          if (error) return { ok: false, error: error.message };
          return { ok: true, summary: `Updated the product “${title}”.` };
        }
        const { error } = await q(supabase.from("products").insert({ ...patch, creator_id: creatorId }));
        if (error) return { ok: false, error: error.message };
        return { ok: true, summary: `Created the product “${title}”.` };
      }

      case "upsert_course": {
        const title = String(input.title ?? "").trim();
        if (!title) return { ok: false, error: "title is required." };
        const { data: existing } = await q<{ id: string }[]>(
          supabase.from("courses").select("id").eq("creator_id", creatorId).ilike("title", title).limit(1)
        );
        const found = (existing ?? [])[0];

        const patch: Json = { title };
        if (typeof input.description === "string") patch.description = input.description;
        if (typeof input.price === "number" && input.price >= 0) patch.price_cents = Math.round(input.price * 100);
        if (input.publish !== undefined) patch.is_published = Boolean(input.publish);

        let courseId: string;
        if (found) {
          const { error } = await q(supabase.from("courses").update(patch).eq("id", found.id).eq("creator_id", creatorId));
          if (error) return { ok: false, error: error.message };
          courseId = found.id;
        } else {
          const { data: created, error } = await q<{ id: string }>(
            supabase.from("courses").insert({ ...patch, creator_id: creatorId }).select("id").single()
          );
          if (error || !created) return { ok: false, error: error?.message ?? "Course insert failed." };
          courseId = created.id;
        }

        const moduleInputs = Array.isArray(input.modules) ? (input.modules as Json[]) : [];
        let lessonsAdded = 0;
        for (const [mi, mIn] of moduleInputs.entries()) {
          const mTitle = String(mIn.title ?? `Module ${mi + 1}`).trim();
          if (!mTitle) continue;
          const { data: mMatch } = await q<{ id: string }[]>(
            supabase.from("modules").select("id").eq("course_id", courseId).ilike("title", mTitle).limit(1)
          );
          let moduleId = (mMatch ?? [])[0]?.id;
          if (!moduleId) {
            const { data: mods } = await q<{ position: number }[]>(
              supabase.from("modules").select("position").eq("course_id", courseId).order("position", { ascending: false }).limit(1)
            );
            const nextPos = (((mods ?? [])[0] ?? { position: -1 }).position ?? -1) + 1;
            const { data: m, error: mErr } = await q<{ id: string }>(
              supabase.from("modules").insert({ course_id: courseId, title: mTitle, position: nextPos }).select("id").single()
            );
            if (mErr || !m) return { ok: false, error: mErr?.message ?? "Module insert failed." };
            moduleId = m.id;
          }

          const lessonInputs = Array.isArray(mIn.lessons) ? (mIn.lessons as Json[]) : [];
          const { data: lastLesson } = await q<{ position: number }[]>(
            supabase.from("lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1)
          );
          let pos = (((lastLesson ?? [])[0] ?? { position: -1 }).position ?? -1) + 1;
          for (const lIn of lessonInputs) {
            const lTitle = String(lIn.title ?? "").trim();
            if (!lTitle) continue;
            const content: Json = {};
            if (typeof lIn.notes === "string") content.description = lIn.notes;
            if (Array.isArray(lIn.quiz)) {
              const questions = (lIn.quiz as Json[])
                .map((qa) => ({
                  id: makeQuizQuestion().id,
                  prompt: String(qa.prompt ?? ""),
                  options: Array.isArray(qa.options) ? qa.options.map((o) => String(o)) : [],
                  correctIndex: typeof qa.correct_index === "number" ? Math.trunc(qa.correct_index) : -1,
                }))
                .filter((qa) => qa.prompt && qa.options.length >= 2);
              if (questions.length) content.material = { kind: "quiz", questions };
            }
            const { error: lErr } = await q(
              supabase.from("lessons").insert({
                module_id: moduleId,
                title: lTitle,
                video_url: typeof lIn.video_url === "string" && lIn.video_url.trim() ? lIn.video_url.trim() : null,
                position: pos++,
                content,
              })
            );
            if (lErr) return { ok: false, error: lErr.message };
            lessonsAdded += 1;
          }
        }

        return {
          ok: true,
          summary: found
            ? `Updated the course “${title}”${lessonsAdded ? ` and added ${lessonsAdded} lesson${lessonsAdded === 1 ? "" : "s"}` : ""}.`
            : `Created the course “${title}”${moduleInputs.length ? ` with ${moduleInputs.length} module${moduleInputs.length === 1 ? "" : "s"}` : ""}${lessonsAdded ? ` and ${lessonsAdded} lesson${lessonsAdded === 1 ? "" : "s"}` : ""}.`,
        };
      }

      case "create_landing_page": {
        const title = String(input.title ?? "").trim();
        const blocksIn = Array.isArray(input.blocks) ? (input.blocks as Json[]) : [];
        if (!title) return { ok: false, error: "title is required." };
        if (!blocksIn.length) return { ok: false, error: "blocks must contain at least one block." };
        const slug = (typeof input.slug === "string" && slugify(input.slug)) || slugify(title);
        if (!slug) return { ok: false, error: "Could not derive a URL slug from the title." };

        const blocks: Block[] = [];
        for (const b of blocksIn) {
          const type = String(b.type ?? "") as BlockType;
          const block = makeBlock(type);
          switch (type) {
            case "heading":
              blocks.push({ ...block, text: String(b.text ?? (block as { text: string }).text), level: ([1, 2, 3].includes(Number(b.level)) ? Number(b.level) : 2) as 1 | 2 | 3, align: "left" } as Block);
              break;
            case "text":
              blocks.push({ ...block, body: String(b.body ?? ""), align: "left" } as Block);
              break;
            case "image":
              blocks.push({ ...block, url: String(b.url ?? ""), alt: String(b.alt ?? ""), caption: String(b.caption ?? "") } as Block);
              break;
            case "cta_button":
              blocks.push({ ...block, label: String(b.label ?? "Get started"), href: String(b.href ?? ""), align: "left" } as Block);
              break;
            case "testimonial":
              blocks.push({ ...block, quote: String(b.quote ?? ""), author: String(b.author ?? ""), role: String(b.role ?? "") } as Block);
              break;
            case "faq":
              blocks.push({
                ...block,
                heading: String(b.heading ?? ""),
                items: Array.isArray(b.items) ? (b.items as Json[]).map((i) => ({ q: String(i.q ?? ""), a: String(i.a ?? "") })) : [],
              } as Block);
              break;
            case "signup_form":
              blocks.push({ ...block, heading: String(b.heading ?? ""), body: String(b.body ?? ""), cta_label: String(b.cta_label ?? "Subscribe"), align: "center" } as Block);
              break;
            case "spacer":
              blocks.push({ ...block, height: Number(b.height) > 0 ? Math.trunc(Number(b.height)) : 48 } as Block);
              break;
            default:
              break;
          }
        }
        if (!blocks.length) return { ok: false, error: "No valid blocks were provided." };

        const { data: clash } = await q<{ id: string }[]>(
          supabase.from("landing_pages").select("id").eq("creator_id", creatorId).eq("slug", slug).limit(1)
        );
        const finalSlug = (clash ?? []).length ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;

        const { data: created, error } = await q<{ id: string; slug: string }>(
          supabase
            .from("landing_pages")
            .insert({
              creator_id: creatorId,
              title,
              slug: finalSlug,
              type: typeof input.page_type === "string" && input.page_type ? input.page_type : "sales",
              is_published: Boolean(input.publish),
              content: { blocks: blocks as unknown as Json[] },
            })
            .select("id, slug")
            .single()
        );
        if (error || !created) return { ok: false, error: error?.message ?? "Landing page insert failed." };
        return {
          ok: true,
          summary: `Created the “${title}” landing page (slug: ${created.slug})${input.publish ? " and published it" : " as a draft — review it before publishing"}.`,
          data: { id: created.id, slug: created.slug },
        };
      }

      default:
        return { ok: false, error: `Unknown tool "${name}".` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tool execution failed." };
  }
}
