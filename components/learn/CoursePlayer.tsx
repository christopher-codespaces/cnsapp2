"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccessCourse, AccessLesson } from "@/lib/access";
import { cn } from "@/lib/utils";

/**
 * Student course player (Phase 6). Receives the access-resolved courses and
 * the learner email from /learn. One lesson at a time, Skool/Kajabi-style:
 * curriculum rail + media/notes pane + material (read-only PDF or quiz) +
 * "Mark complete & continue".
 */
export default function CoursePlayer({
  courses,
  email,
  initialCourseId,
}: {
  courses: AccessCourse[];
  email: string;
  initialCourseId?: string;
}) {
  const [courseId, setCourseId] = useState<string>(
    initialCourseId && courses.some((c) => c.id === initialCourseId)
      ? initialCourseId
      : courses[0].id
  );
  const course = courses.find((c) => c.id === courseId) ?? courses[0];

  const flatLessons = useMemo(() => course.modules.flatMap((m) => m.lessons), [course]);
  const [lessonId, setLessonId] = useState<string | null>(flatLessons[0]?.id ?? null);
  const lesson = flatLessons.find((l) => l.id === lessonId) ?? flatLessons[0] ?? null;

  const doneCount = flatLessons.filter((l) => l.completed).length;
  const pct = flatLessons.length ? Math.round((doneCount / flatLessons.length) * 100) : 0;

  const flatAll = useMemo(() => {
    // stable flat list per course switch — index used for next/prev
    return course.modules.flatMap((m) => m.lessons.map((l) => ({ moduleId: m.id, lesson: l })));
  }, [course]);
  const idx = lesson ? flatAll.findIndex((f) => f.lesson.id === lesson.id) : -1;
  const next = idx >= 0 && idx + 1 < flatAll.length ? flatAll[idx + 1].lesson : null;

  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(flatLessons.filter((l) => l.completed).map((l) => l.id))
  );
  const [savingProgress, setSavingProgress] = useState(false);

  function switchCourse(id: string) {
    const c = courses.find((x) => x.id === id);
    if (!c) return;
    setCourseId(id);
    const first = c.modules.flatMap((m) => m.lessons)[0];
    setLessonId(first?.id ?? null);
    setCompletedIds(new Set(c.modules.flatMap((m) => m.lessons).filter((l) => l.completed).map((l) => l.id)));
  }

  async function completeAndNext() {
    if (!lesson) return;
    setSavingProgress(true);
    try {
      await fetch("/api/course-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", email, lessonId: lesson.id }),
      });
    } catch {
      // non-fatal — progress saving shouldn't block the next lesson
    }
    setCompletedIds((prev) => new Set(prev).add(lesson.id));
    if (next) setLessonId(next.id);
    setSavingProgress(false);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white">
              <GraduationCap className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 leading-tight">{course.title}</p>
              <p className="truncate text-[11px] text-zinc-400 leading-tight">
                {course.creator_name}
                {course.creator_handle ? (
                  <Link href={`/c/${course.creator_handle}`} className="ml-1 underline hover:text-zinc-600">
                    /c/{course.creator_handle}
                  </Link>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-zinc-500">{pct}%</span>
            </div>
            {courses.length > 1 ? (
              <select
                value={courseId}
                onChange={(e) => switchCourse(e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
                aria-label="Switch course"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col lg:flex-row">
        {/* Curriculum rail */}
        <aside className="w-full shrink-0 border-b border-zinc-200 lg:w-80 lg:border-b-0 lg:border-r">
          <div className="max-h-[70vh] overflow-y-auto p-4 lg:sticky lg:top-[57px]">
            {course.description ? (
              <p className="mb-4 text-xs text-zinc-500 whitespace-pre-line">{course.description}</p>
            ) : null}
            {course.modules.map((m, mi) => (
              <div key={m.id} className="mb-4">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Module {mi + 1} — {m.title}
                </p>
                <ul className="space-y-0.5">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setLessonId(l.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                          l.id === lesson?.id
                            ? "bg-zinc-100 font-medium text-zinc-900"
                            : "text-zinc-600 hover:bg-zinc-50"
                        )}
                      >
                        {completedIds.has(l.id) ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-zinc-300" />
                        )}
                        <span className="truncate">{l.title || "Untitled lesson"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!course.modules.length ? (
              <p className="text-sm text-zinc-400">This course doesn&rsquo;t have lessons yet.</p>
            ) : null}
          </div>
        </aside>

        {/* Lesson pane */}
        <main className="min-w-0 flex-1 p-5 sm:p-8">
          {lesson ? (
            <LessonView
              key={lesson.id}
              lesson={lesson}
              email={email}
              done={completedIds.has(lesson.id)}
              onCompleteAndNext={completeAndNext}
              saving={savingProgress}
              hasNext={Boolean(next)}
            />
          ) : (
            <p className="text-sm text-zinc-400">Pick a lesson to begin.</p>
          )}
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function LessonView({
  lesson,
  email,
  done,
  onCompleteAndNext,
  saving,
  hasNext,
}: {
  lesson: AccessLesson;
  email: string;
  done: boolean;
  onCompleteAndNext: () => void;
  saving: boolean;
  hasNext: boolean;
}) {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2">
        {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <PlayCircle className="h-5 w-5 text-zinc-400" />}
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          {lesson.title || "Untitled lesson"}
        </h1>
      </div>

      {lesson.videoUrl ? (
        <div className="mt-5 overflow-hidden rounded-xl bg-zinc-950 shadow-sm">
          {lesson.videoKind === "external" ? (
            <StudentVideo url={lesson.videoUrl} title={lesson.title || "Lesson"} />
          ) : (
            <video
              src={lesson.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full"
            />
          )}
        </div>
      ) : null}

      {lesson.description ? (
        <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-zinc-600">
          {lesson.description}
        </p>
      ) : null}

      {lesson.material?.kind === "pdf" ? (
        <PdfMaterial url={lesson.material.url} />
      ) : null}
      {lesson.material?.kind === "quiz" ? (
        <QuizMaterial questions={lesson.material.questions} email={email} lessonId={lesson.id} />
      ) : null}

      <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-5">
        <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Materials are read-only — streaming &amp; viewing only
        </p>
        <Button onClick={onCompleteAndNext} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {done ? (hasNext ? "Continue" : "Done") : "Mark complete & continue"}
          {hasNext ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </Button>
      </div>
    </article>
  );
}

/** External (Loom/YouTube/Vimeo) lesson video — click-to-play 16:9. */
function StudentVideo({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = toEmbed(url);
  if (!embed || playing) {
    return embed ? (
      <iframe
        src={embed + (playing ? (embed.includes("?") ? "&" : "?") + "autoplay=1" : "")}
        title={title}
        className="aspect-video w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
      />
    ) : (
      <a href={url} target="_blank" rel="noreferrer" className="block aspect-video w-full bg-zinc-900 p-6 text-center text-sm text-white underline">
        Watch video
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group flex aspect-video w-full items-center justify-center"
      aria-label={`Play ${title}`}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg transition-transform group-hover:scale-105">
        <PlayCircle className="h-7 w-7" />
      </span>
    </button>
  );
}

function toEmbed(url: string): string | null {
  const u = url;
  let m = u.match(/loom\.com\/share\/([a-f0-9]+)/i);
  if (m) return `https://www.loom.com/embed/${m[1]}`;
  m = u.match(/youtube\.com\/watch\?v=([\w-]{6,})/i) || u.match(/youtu\.be\/([\w-]{6,})/i) || u.match(/youtube\.com\/shorts\/([\w-]{6,})/i);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = u.match(/vimeo\.com\/(\d+)/i);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  if (/youtube\.com\/embed\//i.test(u) || /loom\.com\/embed\//i.test(u) || /player\.vimeo\.com\//i.test(u)) return u;
  return null;
}

/** Read-only PDF: toolbar-less iframe, no download/print affordance. */
function PdfMaterial({ url }: { url: string }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3 rounded-t-xl border border-b-0 border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <FileText className="h-4 w-4 text-zinc-400" />
          Lesson material
        </p>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Read-only · downloads disabled
        </span>
      </div>
      <iframe
        src={`${url}#toolbar=0&navpanes=0&view=FitH`}
        title="Lesson PDF (read-only)"
        className="h-[560px] w-full rounded-b-xl border border-zinc-200 bg-white"
      />
    </section>
  );
}

/** Quiz-taking UI. Correct answers never reach the browser until submission. */
function QuizMaterial({
  questions,
  email,
  lessonId,
}: {
  questions: { id: string; prompt: string; options: string[] }[];
  email: string;
  lessonId: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    // Correct answers never ship to the browser — resolveAccess strips them —
    // so grading happens server-side via quiz-grade.
    try {
      const res = await fetch("/api/course-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quiz-grade", email, lessonId, answers }),
      });
      const data = (await res.json()) as { score?: number; total?: number; error?: string };
      if (res.ok && typeof data.score === "number" && typeof data.total === "number") {
        setResult({ score: data.score, total: data.total });
      } else {
        setResult({ score: 0, total: questions.length });
      }
    } catch {
      setResult({ score: 0, total: questions.length });
    }
    setSubmitting(false);
  }

  const answeredAll = questions.every((q) => answers[q.id] !== undefined);

  return (
    <section className="mt-6 rounded-xl border border-zinc-200">
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2.5 rounded-t-xl">
        <HelpCircle className="h-4 w-4 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-700">Knowledge check</p>
      </div>
      <div className="space-y-5 p-4">
        {questions.map((q, qi) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-zinc-800">
              {qi + 1}. {q.prompt}
            </p>
            <div className="mt-2 space-y-1.5">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={Boolean(result)}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      selected
                        ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300",
                      result && selected && "border-emerald-400 bg-emerald-50 text-emerald-800"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-zinc-900" : "border-zinc-300"
                      )}
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-zinc-900" /> : null}
                    </span>
                    {opt}
                  </button>);
              })}
            </div>
          </div>
        ))}

        {result ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
            You scored {result.score} / {result.total}. Saved to your progress.
          </div>
        ) : (
          <Button onClick={submit} disabled={!answeredAll || submitting} size="sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit answers
          </Button>
        )}
      </div>
    </section>
  );
}
