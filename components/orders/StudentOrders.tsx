"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GraduationCap,
  Loader2,
  Package,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";

interface StudentOrder {
  id: string;
  status: string;
  amount_cents: number;
  created_at: string;
  kind: "product" | "course";
  item_title: string;
  learn_url: string | null;
}

interface StudentCourse {
  id: string;
  title: string;
  learn_url: string;
}

type Resolved = { orders: StudentOrder[]; courses: StudentCourse[] };

const STORAGE_KEY = "cns:student-email";

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
        <XCircle className="h-3 w-3" /> Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

/**
 * The buyer's own dashboard (/orders). Email-gated like the course player —
 * the checkout email is the credential; the server resolves exactly what that
 * email owns. Remembers the email in localStorage for convenience.
 */
export default function StudentOrders({ prefillEmail }: { prefillEmail?: string }) {
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: string) => {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/course-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "orders", email: target }),
      });
      const data = (await res.json()) as Resolved & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load your orders");
      setResolved({ orders: data.orders ?? [], courses: data.courses ?? [] });
      setEmail(target);
      try {
        window.localStorage.setItem(STORAGE_KEY, target);
      } catch {
        /* private mode — non-fatal */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your orders");
    } finally {
      setLoading(false);
    }
  }, []);

  // Prefill from ?email=… or a previous visit (async IIFE inside the effect —
  // keeps state updates out of the synchronous effect body).
  useEffect(() => {
    (async () => {
      if (prefillEmail) {
        await load(prefillEmail);
        return;
      }
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) await load(saved);
      } catch {
        /* ignore */
      }
    })();
  }, [prefillEmail, load]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void load(email.trim().toLowerCase());
  }

  if (!resolved) {
    // Gate — identical UX to the course player.
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
        >
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-white">
            <Receipt className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-center text-xl font-bold tracking-tight text-zinc-900">
            Your orders
          </h1>
          <p className="mt-1 text-center text-sm text-zinc-500">
            Enter the email you used at checkout.
          </p>
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-5"
          />
          <Button type="submit" disabled={loading} className="mt-3 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "View my orders"}
          </Button>
          {error ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-600">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Your orders</h1>
          <p className="mt-1 text-sm text-zinc-500">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setResolved(null);
            try {
              window.localStorage.removeItem(STORAGE_KEY);
            } catch {
              /* ignore */
            }
          }}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        >
          Not you?
        </button>
      </div>

      {resolved.courses.length ? (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your courses
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {resolved.courses.map((c) => (
              <a
                key={c.id}
                href={c.learn_url}
                className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <GraduationCap className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-medium text-zinc-900">{c.title}</span>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Order history
        </h2>
        {resolved.orders.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-3 text-sm text-zinc-500">
              No orders yet for this email.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Purchases you make on any creator storefront will appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            {resolved.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                  {o.kind === "course" ? (
                    <GraduationCap className="h-4 w-4" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{o.item_title}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(o.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {o.kind === "course" ? "Course" : "Product"}
                  </p>
                </div>
                <StatusBadge status={o.status} />
                <span className="text-sm font-semibold text-zinc-900">
                  {o.amount_cents > 0 ? formatPrice(o.amount_cents) : "Free"}
                </span>
                {o.learn_url ? (
                  <a
                    href={o.learn_url}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                  >
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
