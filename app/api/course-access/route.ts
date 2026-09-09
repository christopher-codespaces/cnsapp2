import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/paystack";
import { resolveAccess, markLessonComplete, saveQuizAttempt, gradeQuiz, getStudentOrders, EMAIL_RE } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/course-access
 *  { action: "resolve", email }                          -> purchased courses + progress
 *  { action: "complete", email, lessonId }               -> mark a lesson complete
 *  { action: "quiz", email, lessonId, score, total }     -> save a quiz attempt
 *
 * Student-side endpoint (no auth account): access is exactly what the
 * enrollments table says it is, resolved through the service role.
 */
export async function POST(req: Request) {
  let body: {
    action?: string;
    email?: string;
    lessonId?: string;
    score?: number;
    total?: number;
    answers?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }

  if (body.action === "resolve") {
    const result = await resolveAccess(admin, email);
    return NextResponse.json(result);
  }

  if (body.action === "complete") {
    const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }
    const result = await markLessonComplete(admin, email, lessonId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Could not save progress" }, { status: result.status ?? 403 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "orders") {
    const result = await getStudentOrders(admin, email);
    return NextResponse.json(result);
  }

  if (body.action === "quiz") {
    const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
    const score = typeof body.score === "number" ? Math.max(0, Math.floor(body.score)) : -1;
    const total = typeof body.total === "number" ? Math.max(0, Math.floor(body.total)) : -1;
    if (!lessonId || score < 0 || total <= 0) {
      return NextResponse.json({ error: "lessonId, score and total are required" }, { status: 400 });
    }
    const result = await saveQuizAttempt(admin, email, lessonId, score, total);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Could not save the attempt" }, { status: result.status ?? 403 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "quiz-grade") {
    const lessonId = typeof body.lessonId === "string" ? body.lessonId : "";
    const answers =
      body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
        ? (body.answers as Record<string, unknown>)
        : {};
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId is required" }, { status: 400 });
    }
    // Sanitize: keys are question ids, values are option indexes.
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === "number" && Number.isInteger(v) && v >= 0) clean[k] = v;
    }
    const result = await gradeQuiz(admin, email, lessonId, clean);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Could not grade the quiz" }, { status: result.status ?? 403 });
    }
    return NextResponse.json({ score: result.score, total: result.total });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
