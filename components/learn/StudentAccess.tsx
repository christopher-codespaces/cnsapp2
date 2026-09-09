"use client";

import { useCallback, useEffect, useState } from "react";
import LearnGate from "@/components/learn/LearnGate";
import CoursePlayer from "@/components/learn/CoursePlayer";
import type { AccessCourse } from "@/lib/access";

/**
 * Client shell for /learn: owns the resolved-access state. When the URL
 * carries ?email=… (the bookmarkable post-checkout link) it resolves once on
 * mount; otherwise the email gate collects it.
 */
export default function StudentAccess({
  prefillEmail,
  courseId,
}: {
  prefillEmail: string;
  courseId: string;
}) {
  const [access, setAccess] = useState<{ courses: AccessCourse[]; email: string } | null>(null);
  const [checkingLink, setCheckingLink] = useState(Boolean(prefillEmail));

  const resolve = useCallback(async (email: string): Promise<AccessCourse[]> => {
    const res = await fetch("/api/course-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", email }),
    });
    const data = (await res.json()) as { courses?: AccessCourse[]; error?: string };
    if (!res.ok) throw new Error(data.error || "Could not check your access");
    return data.courses ?? [];
  }, []);

  useEffect(() => {
    if (!prefillEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const courses = await resolve(prefillEmail);
        if (!cancelled) {
          if (courses.length) {
            setAccess({ courses, email: prefillEmail });
          } else {
            setCheckingLink(false); // fall back to the gate
          }
        }
      } catch {
        if (!cancelled) setCheckingLink(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefillEmail, resolve]);

  if (checkingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-zinc-400">Opening your course…</p>
      </div>
    );
  }

  if (!access) {
    return (
      <LearnGate
        onResolved={(courses, email) => setAccess({ courses, email })}
      />
    );
  }

  return (
    <CoursePlayer courses={access.courses} email={access.email} initialCourseId={courseId || undefined} />
  );
}
