// =============================================================================
// CNS Creator OS — student access helpers (server-side)
// -----------------------------------------------------------------------------
// The student course player identifies learners by email (no auth account).
// The browser posts the email to /api/course-access, which resolves purchased
// courses through the service role; the email never grants anything the
// database doesn't say it has.
//
// Private lesson videos (course-videos) and PDFs (course-files) are resolved
// to short-lived signed URLs server-side, so students can stream/read them
// without ever touching the buckets directly.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLessonVideo } from "@/lib/storage";
import { normalizeLessonMaterial } from "@/types/course";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AccessLesson {
  id: string;
  title: string;
  position: number;
  completed: boolean;
  /** Signed/absolute URL ready for playback, or null when none. */
  videoUrl: string | null;
  /** "private" when videoUrl is a signed bucket URL, "external" otherwise. */
  videoKind: "private" | "external" | null;
  description: string | null;
  material:
    | { kind: "pdf"; url: string }
    | { kind: "quiz"; questions: { id: string; prompt: string; options: string[] }[] }
    | null;
}

export interface AccessModule {
  id: string;
  title: string;
  position: number;
  lessons: AccessLesson[];
}

export interface AccessCourse {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  creator_name: string;
  creator_handle: string | null;
  modules: AccessModule[];
}

/** eslint helper: the hand-rolled Database type lacks Relationships keys. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

async function signIfNeeded(
  admin: SupabaseClient,
  value: string | null,
  bucket: "course-videos" | "course-files"
): Promise<string | null> {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  try {
    const { data } = await admin.storage.from(bucket).createSignedUrl(v, 60 * 60);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the courses an email can open, with module/lesson tree, signed
 * media, and completion state. Unknown/unpurchased emails resolve to an
 * empty courses array.
 */
export async function resolveAccess(
  admin: SupabaseClient,
  email: string
): Promise<{ courses: AccessCourse[] }> {
  // 1. learner + enrollments
   
  const { data: learner } = await (admin.from("learners") as AnyTable)
    .select("id")
    .eq("email", email)
    .maybeSingle();
  const learnerId = (learner as { id: string } | null)?.id;
  if (!learnerId) return { courses: [] };

   
  const { data: enrollments } = await (admin.from("enrollments") as AnyTable)
    .select("course_id")
    .eq("learner_id", learnerId);
  const courseIds = ((enrollments ?? []) as { course_id: string }[]).map((e) => e.course_id);
  if (!courseIds.length) return { courses: [] };

  // 2. courses (published only) + creator brand names
   
  const { data: courses } = await (admin.from("courses") as AnyTable)
    .select("id, title, description, cover_image_url, creator_id, is_published")
    .in("id", courseIds)
    .eq("is_published", true);
  const rows = (courses ?? []) as {
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    creator_id: string;
  }[];
  if (!rows.length) return { courses: [] };

  const creatorIds = [...new Set(rows.map((r) => r.creator_id))];
   
  const { data: creators } = await (admin.from("creators") as AnyTable)
    .select("id, brand_name, handle")
    .in("id", creatorIds);
  const brands = new Map(
    ((creators ?? []) as { id: string; brand_name: string; handle: string | null }[]).map((c) => [
      c.id,
      { name: c.brand_name, handle: c.handle },
    ])
  );

  // 3. curriculum
   
  const { data: modules } = await (admin.from("modules") as AnyTable)
    .select("id, course_id, title, position")
    .in("course_id", rows.map((r) => r.id))
    .order("position", { ascending: true });
  const moduleRows = (modules ?? []) as { id: string; course_id: string; title: string; position: number | null }[];

  let lessonRows: {
    id: string;
    module_id: string;
    title: string;
    video_url: string | null;
    content: Record<string, unknown> | null;
    position: number | null;
  }[] = [];
  if (moduleRows.length) {
     
    const { data: lessons } = await (admin.from("lessons") as AnyTable)
      .select("id, module_id, title, video_url, content, position")
      .in("module_id", moduleRows.map((m) => m.id))
      .order("position", { ascending: true });
    lessonRows = (lessons ?? []) as typeof lessonRows;
  }

  // 4. progress
   
  const { data: progress } = await (admin.from("lesson_progress") as AnyTable)
    .select("lesson_id")
    .eq("learner_id", learnerId);
  const completed = new Set(((progress ?? []) as { lesson_id: string }[]).map((p) => p.lesson_id));

  // 5. sign private media in parallel
  const signed = await Promise.all(
    lessonRows.map(async (l) => {
      const video = parseLessonVideo(l.video_url);
      const videoUrl =
        video?.kind === "external"
          ? video.url
          : video?.kind === "private"
            ? await signIfNeeded(admin, video.path, "course-videos")
            : null;
      const material = normalizeLessonMaterial(l.content?.material);
      let resolvedMaterial: AccessLesson["material"] = null;
      if (material?.kind === "pdf") {
        const pdfUrl = await signIfNeeded(admin, material.url, "course-files");
        if (pdfUrl) resolvedMaterial = { kind: "pdf", url: pdfUrl };
      } else if (material?.kind === "quiz") {
        resolvedMaterial = {
          kind: "quiz",
          questions: material.questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            options: q.options,
          })),
        };
      }
      return {
        videoUrl,
        videoKind: videoUrl ? (/^https?:\/\//i.test(l.video_url ?? "") ? ("external" as const) : ("private" as const)) : null,
        material: resolvedMaterial,
      };
    })
  );

  const lessonExtras = new Map(signed.map((s, i) => [lessonRows[i].id, s]));

  const lessonByModule = new Map<string, AccessLesson[]>();
  for (const l of lessonRows) {
    const extras = lessonExtras.get(l.id);
    const list = lessonByModule.get(l.module_id) ?? [];
    list.push({
      id: l.id,
      title: l.title,
      position: l.position ?? 0,
      completed: completed.has(l.id),
      videoUrl: extras?.videoUrl ?? null,
      videoKind: extras?.videoKind ?? null,
      description: typeof l.content?.description === "string" ? (l.content.description as string) : null,
      material: extras?.material ?? null,
    });
    lessonByModule.set(l.module_id, list);
  }

  const byCourse = new Map<string, AccessModule[]>();
  for (const m of moduleRows) {
    const list = byCourse.get(m.course_id) ?? [];
    list.push({
      id: m.id,
      title: m.title,
      position: m.position ?? 0,
      lessons: (lessonByModule.get(m.id) ?? []).sort((a, b) => a.position - b.position),
    });
    byCourse.set(m.course_id, list);
  }

  return {
    courses: rows.map((r) => {
      const brand = brands.get(r.creator_id);
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        cover_image_url: r.cover_image_url,
        creator_name: brand?.name ?? "Creator",
        creator_handle: brand?.handle ?? null,
        modules: (byCourse.get(r.id) ?? []).sort((a, b) => a.position - b.position),
      };
    }),
  };
}

/** Shared gate: does this email have a live enrollment covering this lesson? */
async function checkLessonAccess(
  admin: SupabaseClient,
  email: string,
  lessonId: string
): Promise<{ learnerId: string } | { error: string; status: number }> {
   
  const { data: learner } = await (admin.from("learners") as AnyTable)
    .select("id")
    .eq("email", email)
    .maybeSingle();
  const learnerId = (learner as { id: string } | null)?.id;
  if (!learnerId) return { error: "not enrolled", status: 403 };

   
  const { data: lesson } = await (admin.from("lessons") as AnyTable)
    .select("id, module_id")
    .eq("id", lessonId)
    .maybeSingle();
  const moduleId = (lesson as { module_id: string } | null)?.module_id;
  if (!moduleId) return { error: "lesson not found", status: 404 };

   
  const { data: moduleRow } = await (admin.from("modules") as AnyTable)
    .select("course_id")
    .eq("id", moduleId)
    .maybeSingle();
  const courseId = (moduleRow as { course_id: string } | null)?.course_id;
  if (!courseId) return { error: "module not found", status: 404 };

   
  const { data: enrolled } = await (admin.from("enrollments") as AnyTable)
    .select("id")
    .eq("learner_id", learnerId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!enrolled) return { error: "not enrolled", status: 403 };

  return { learnerId };
}

/** Record a completed lesson (idempotent per learner+lesson). */
export async function markLessonComplete(
  admin: SupabaseClient,
  email: string,
  lessonId: string
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const gate = await checkLessonAccess(admin, email, lessonId);
  if ("error" in gate) return { ok: false, error: gate.error, status: gate.status };

  // Resolve the course id for the progress row.
   
  const { data: lesson } = await (admin.from("lessons") as AnyTable)
    .select("module_id")
    .eq("id", lessonId)
    .maybeSingle();
  const moduleId = (lesson as { module_id: string } | null)?.module_id;
   
  const { data: moduleRow } = await (admin.from("modules") as AnyTable)
    .select("course_id")
    .eq("id", moduleId ?? "")
    .maybeSingle();
  const courseId = (moduleRow as { course_id: string } | null)?.course_id;
  if (!courseId) return { ok: false, error: "module not found", status: 404 };

   
  const { error } = await (admin.from("lesson_progress") as AnyTable).upsert(
    {
      learner_id: gate.learnerId,
      lesson_id: lessonId,
      course_id: courseId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "learner_id,lesson_id" }
  );
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true };
}

/** Save a quiz submission from the player. */
export async function saveQuizAttempt(
  admin: SupabaseClient,
  email: string,
  lessonId: string,
  score: number,
  total: number
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const gate = await checkLessonAccess(admin, email, lessonId);
  if ("error" in gate) return { ok: false, error: gate.error, status: gate.status };

   
  const { error } = await (admin.from("quiz_attempts") as AnyTable).insert({
    learner_id: gate.learnerId,
    lesson_id: lessonId,
    score,
    total,
  });
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true };
}

/**
 * Grade a quiz server-side (correct answers never reach the browser) and
 * record the attempt. `answers` maps question id -> chosen option index.
 */
export async function gradeQuiz(
  admin: SupabaseClient,
  email: string,
  lessonId: string,
  answers: Record<string, number>
): Promise<{ ok: boolean; score?: number; total?: number; error?: string; status?: number }> {
  const gate = await checkLessonAccess(admin, email, lessonId);
  if ("error" in gate) return { ok: false, error: gate.error, status: gate.status };

   
  const { data: lesson } = await (admin.from("lessons") as AnyTable)
    .select("content")
    .eq("id", lessonId)
    .maybeSingle();
  const material = normalizeLessonMaterial(
    (lesson as { content: Record<string, unknown> | null } | null)?.content?.material
  );
  if (!material || material.kind !== "quiz") {
    return { ok: false, error: "This lesson has no quiz", status: 404 };
  }

  const total = material.questions.length;
  const score = material.questions.reduce(
    (acc, q) => acc + (answers[q.id] !== undefined && answers[q.id] === q.correctIndex ? 1 : 0),
    0
  );

  const saved = await saveQuizAttempt(admin, email, lessonId, score, total);
  if (!saved.ok) return { ok: false, error: saved.error, status: saved.status };
  return { ok: true, score, total };
}

/* ------------------------------------------------------------------ */
/* Student order history                                               */
/* ------------------------------------------------------------------ */

export interface StudentOrder {
  id: string;
  status: "pending" | "paid" | "refunded" | string;
  amount_cents: number;
  created_at: string;
  kind: "product" | "course";
  item_title: string;
  item_id: string | null;
  /** For paid courses — the /learn deep link. */
  learn_url: string | null;
}

/**
 * The buyer's own order history + what they can open. Identified purely by
 * email (the checkout credential) and resolved through the service role.
 */
export async function getStudentOrders(
  admin: SupabaseClient,
  email: string
): Promise<{ orders: StudentOrder[]; courses: { id: string; title: string; learn_url: string }[] }> {
   
  const { data: learner } = await (admin.from("learners") as AnyTable)
    .select("id")
    .eq("email", email)
    .maybeSingle();
  const learnerId = (learner as { id: string } | null)?.id;
  if (!learnerId) return { orders: [], courses: [] };

   
  const { data: orderRows } = await (admin.from("orders") as AnyTable)
    .select("id, status, amount_cents, created_at, product_id, course_id")
    .eq("customer_id", learnerId)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (orderRows ?? []) as {
    id: string;
    status: string;
    amount_cents: number;
    created_at: string;
    product_id: string | null;
    course_id: string | null;
  }[];

  // Titles for the referenced items (paid + free alike).
  const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))] as string[];
  const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))] as string[];
  const [prodRes, courseRes] = await Promise.all([
    productIds.length
       
      ? (admin.from("products") as AnyTable).select("id, title").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    courseIds.length
       
      ? (admin.from("courses") as AnyTable).select("id, title").in("id", courseIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const titles = new Map<string, string>([
    ...(((prodRes.data ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title] as const)),
    ...(((courseRes.data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title] as const)),
  ]);

  // Purchased (paid) courses the learner can open right now.
   
  const { data: enrolled } = await (admin.from("enrollments") as AnyTable)
    .select("course_id")
    .eq("learner_id", learnerId);
  const enrolledIds = ((enrolled ?? []) as { course_id: string }[]).map((e) => e.course_id);
  const openCourses = courseIds.filter((cid) => enrolledIds.includes(cid));

  const orders: StudentOrder[] = rows.map((r) => {
    const isCourse = Boolean(r.course_id);
    const itemId = (r.course_id ?? r.product_id) as string | null;
    const canOpen = isCourse && r.status === "paid" && r.course_id !== null && enrolledIds.includes(r.course_id);
    return {
      id: r.id,
      status: r.status,
      amount_cents: r.amount_cents,
      created_at: r.created_at,
      kind: isCourse ? "course" : "product",
      item_title: (itemId ? titles.get(itemId) : null) ?? (isCourse ? "Course" : "Product"),
      item_id: itemId,
      learn_url: canOpen && r.course_id ? `/learn?course=${r.course_id}&email=${encodeURIComponent(email)}` : null,
    };
  });

  // Also surface enrolled courses even if no order row exists (e.g. AI-era
  // manual enrollments) so "open" is always possible from the dashboard.
  const missingCourseIds = enrolledIds.filter((cid) => !courseIds.includes(cid));
  let extraCourses: { id: string; title: string; learn_url: string }[] = [];
  if (missingCourseIds.length) {
     
    const { data: extra } = await (admin.from("courses") as AnyTable)
      .select("id, title")
      .in("id", missingCourseIds);
    extraCourses = ((extra ?? []) as { id: string; title: string }[]).map((c) => ({
      id: c.id,
      title: c.title,
      learn_url: `/learn?course=${c.id}&email=${encodeURIComponent(email)}`,
    }));
  }

  const courses = openCourses.map((cid) => ({
    id: cid,
    title: titles.get(cid) ?? "Course",
    learn_url: `/learn?course=${cid}&email=${encodeURIComponent(email)}`,
  }));

  return { orders, courses: [...courses, ...extraCourses] };
}
