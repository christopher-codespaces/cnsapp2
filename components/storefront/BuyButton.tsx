"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

/**
 * "Buy" button used on public storefront catalog cards (and the /thanks
 * up-sell). Opens a small email modal and starts Stripe Checkout via
 * /api/checkout. Free items enroll instantly and land on /thanks.
 *
 * In the builder preview (`creatorId` null) it renders as a disabled button —
 * checkout only exists on the live page.
 */
export default function BuyButton({
  kind,
  itemId,
  title,
  priceCents,
  creatorId,
  className,
  label,
}: {
  kind: "product" | "course";
  itemId: string;
  title: string;
  priceCents: number;
  creatorId: string | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Signed-in buyers skip the email step — their account email is the
  // purchase credential (purchases attach to their account automatically).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session?.user?.email) setSignedInEmail(session.user.email);
      } catch {
        /* anonymous visitor — normal email modal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const disabled = !creatorId;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = (signedInEmail ?? email).trim();
    if (!trimmed) return;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id: itemId, email: trimmed }),
      });
      const data = (await res.json()) as { url?: string; error?: string; detail?: string };
      if (!res.ok || !data.url) {
        // Surface the server's `detail` (dev diagnostics) when present.
        const detail = data.detail ? ` — ${data.detail}` : "";
        throw new Error((data.error || "Checkout failed") + detail);
      }
      if (data.url.startsWith("http")) {
        window.location.href = data.url; // Stripe-hosted
      } else {
        window.location.href = data.url; // internal /thanks
      }
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Checkout failed" });
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setStatus({ kind: "idle" });
          setOpen(true);
        }}
        className={
          className ??
          "mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        }
        title={disabled ? "Live once published" : undefined}
      >
        {priceCents > 0 ? (
          <>
            <Lock className="h-3.5 w-3.5 opacity-70" />
            Buy — {formatPrice(priceCents)}
          </>
        ) : (
          label || "Get free access"
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Buy ${title}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-zinc-900 leading-snug">{title}</h3>
                <p className="mt-0.5 text-sm text-zinc-500">{formatPrice(priceCents)}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={start} className="mt-4 flex flex-col gap-2.5">
              {signedInEmail ? (
                <p className="rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                  Buying as <span className="font-medium text-zinc-900">{signedInEmail}</span> — it
                  goes straight to your account.
                </p>
              ) : (
                <>
                  <label htmlFor={`buy-email-${itemId}`} className="text-xs font-medium text-zinc-600">
                    Your email — this becomes your course access
                  </label>
                  <Input
                    id={`buy-email-${itemId}`}
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </>
              )}
              <Button type="submit" disabled={status.kind === "loading"} className="w-full">
                {status.kind === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    {signedInEmail
                      ? priceCents > 0
                        ? `Pay ${formatPrice(priceCents)} securely`
                        : "Get instant access"
                      : "Continue to secure checkout"}
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-zinc-400">
                Payments are processed securely by Paystack. We never see your card details.
              </p>
              {status.kind === "error" ? (
                <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                  {status.message}
                </p>
              ) : null}
              <p className="text-center text-[11px] text-zinc-400">
                Already purchased?{" "}
                <a href="/orders" className="underline hover:text-zinc-600">
                  View your orders
                </a>
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
