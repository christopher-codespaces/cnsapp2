"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/**
 * Public email-capture form used by the storefront Email Signup section and
 * landing page signup_form blocks. Inserts into `subscribers` anonymously —
 * the RLS "public can subscribe to published pages" policy gates the insert.
 *
 * `creatorId` is null in the builders' live preview (nothing is saved there);
 * the form then renders disabled with a hint instead.
 */
export default function EmailCaptureForm({
  creatorId,
  sourceId,
  ctaLabel = "Subscribe",
}: {
  creatorId: string | null;
  sourceId?: string | null;
  ctaLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const disabled = !creatorId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!creatorId) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setStatus({ kind: "loading" });
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // The hand-rolled Database type lacks Relationships keys, so the
      // generic write builder resolves to never.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("subscribers") as any).insert({
        creator_id: creatorId,
        email: trimmed,
        source: sourceId || null,
      });
      if (error) throw error;
      // Public signup event for the creator's analytics (RLS-gated to
      // published storefronts; failure is non-fatal for the subscriber).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("analytics_events") as any).insert({
          creator_id: creatorId,
          event_type: "signup",
          metadata: { source: sourceId || "storefront" },
        });
      } catch {
        // ignore
      }
      setEmail("");
      setStatus({ kind: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setStatus({ kind: "error", message });
    }
  }

  if (status.kind === "done") {
    return (
      <p className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 text-center">
        You&rsquo;re on the list — talk soon!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        type="email"
        required
        disabled={disabled}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="bg-white"
        aria-label="Email address"
      />
      <Button type="submit" disabled={disabled || status.kind === "loading"} className="shrink-0">
        {status.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {ctaLabel || "Subscribe"}
      </Button>
      {!creatorId ? (
        <p className="text-xs text-zinc-400 basis-full">
          Signups activate once this page is published.
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p className="text-xs text-red-600 basis-full">{status.message}</p>
      ) : null}
    </form>
  );
}
