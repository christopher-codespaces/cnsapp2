"use client";

import { useState } from "react";
import { GraduationCap, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AccessCourse } from "@/lib/access";

/**
 * Email gate for the student course player (/learn). The buyer's email is the
 * credential — it must match an enrollment created by checkout. On success it
 * hands the resolved courses + email up to the player.
 */
export default function LearnGate({
  onResolved,
}: {
  onResolved: (courses: AccessCourse[], email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/course-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", email: trimmed }),
      });
      const data = (await res.json()) as { courses?: AccessCourse[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not check your access");
      const courses = data.courses ?? [];
      if (!courses.length) {
        throw new Error("No courses found for that email. Double-check the address you used at checkout.");
      }
      onResolved(courses, trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-6 py-24">
      <div className="mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand text-white">
          <GraduationCap className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-center text-xl font-bold tracking-tight text-zinc-900">
          Welcome to your course
        </h1>
        <p className="mt-1.5 text-center text-sm text-zinc-500">
          Enter the email you used at checkout.
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-2.5">
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Your purchase email"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Open my courses
            <ArrowRight className="h-4 w-4" />
          </Button>
          {error ? (
            <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</p>
          ) : null}
          <p className="text-center text-[11px] text-zinc-400">
            Looking for a receipt?{" "}
            <a href="/orders" className="underline hover:text-zinc-600">
              View your orders →
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
