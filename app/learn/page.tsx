import StudentAccess from "@/components/learn/StudentAccess";

export const dynamic = "force-dynamic";

/**
 * Student course player (/learn). Email-gated: the buyer's email resolves to
 * their enrollments through /api/course-access. ?course=<id> (from the
 * checkout redirect) preselects the just-purchased course; ?email=… skips the
 * gate when it resolves (bookmarkable access link).
 */
export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const prefillEmail = (sp.email ?? "").trim();
  const courseId = (sp.course ?? "").trim();

  return (
    <main className="min-h-screen bg-white">
      <StudentAccess prefillEmail={prefillEmail} courseId={courseId} />
    </main>
  );
}
