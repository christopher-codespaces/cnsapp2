"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Post-purchase verification nudge on /thanks. Paystack webhooks can't reach
 * localhost, so when the buyer returns with ?reference=… we ask the server to
 * verify + fulfill (idempotent — safe even if the webhook already did it).
 */
export default function VerifyPurchase({ reference }: { reference: string }) {
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`);
        if (!cancelled) setState(res.ok ? "ok" : "fail");
      } catch {
        if (!cancelled) setState("fail");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <p
      className={cn(
        "mt-3 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs",
        state === "loading" && "border-zinc-200 bg-zinc-50 text-zinc-500",
        state === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        state === "fail" && "border-amber-200 bg-amber-50 text-amber-700"
      )}
    >
      {state === "loading" ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming your payment…
        </>
      ) : state === "ok" ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" /> Payment confirmed — your access is active.
        </>
      ) : (
        <>
          <XCircle className="h-3.5 w-3.5" /> We couldn&apos;t confirm the payment yet — if you were
          charged, access is granted automatically when the payment webhook arrives.
        </>
      )}
    </p>
  );
}
