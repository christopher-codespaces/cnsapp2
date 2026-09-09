// =============================================================================
// CNS Creator OS — Course lesson material shapes
// -----------------------------------------------------------------------------
// A lesson can carry, besides `video_url`, a read-only material stored under
// `lessons.content.material`:
//
//   content: {
//     description?: string,
//     material?: { kind: "pdf",  url: string }              // private course-files object path or external URL
//               | { kind: "quiz", questions: QuizQuestion[] }
//   }
//
// PDFs are kept in the PRIVATE `course-files` bucket and are meant to be viewed
// inline only (no download affordance). Normalizers keep legacy/AI-shaped jsonb
// from crashing the editor.
// =============================================================================

import { makeId } from "@/types/blocks";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  /** Index of the correct option; -1 means no answer has been marked yet. */
  correctIndex: number;
}

export type LessonMaterial =
  | { kind: "pdf"; url: string }
  | { kind: "quiz"; questions: QuizQuestion[] };

export function makeQuizQuestion(): QuizQuestion {
  return { id: makeId(), prompt: "", options: ["", ""], correctIndex: -1 };
}

/** Coerce a raw `content.material` jsonb value into a known LessonMaterial (or null). */
export function normalizeLessonMaterial(raw: unknown): LessonMaterial | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (o.kind === "pdf") {
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url) return null;
    return { kind: "pdf", url };
  }

  if (o.kind === "quiz" && Array.isArray(o.questions)) {
    const questions = o.questions
      .map((q): QuizQuestion | null => {
        if (!q || typeof q !== "object") return null;
        const qo = q as Record<string, unknown>;
        const options = Array.isArray(qo.options)
          ? qo.options.filter((x): x is string => typeof x === "string")
          : [];
        if (!options.length) return null;
        return {
          id: typeof qo.id === "string" && qo.id ? qo.id : makeId(),
          prompt: typeof qo.prompt === "string" ? qo.prompt : "",
          options,
          correctIndex: typeof qo.correctIndex === "number" ? qo.correctIndex : -1,
        };
      })
      .filter((q): q is QuizQuestion => q !== null);
    if (!questions.length) return null;
    return { kind: "quiz", questions };
  }

  return null;
}