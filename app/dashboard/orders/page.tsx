"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: string;
  status: "pending" | "paid" | "refunded";
  amount_cents: number;
  created_at: string;
  product_title: string | null;
  course_title: string | null;
  learner_email: string | null;
}

/**
 * Creator-facing sales list: paid + pending orders across products and
 * courses, with revenue totals. Reads `orders` (owner RLS) and joins names
 * client-side from simple id lookups.
 */
export default function OrdersPage() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; orders: OrderRow[]; totals: { paid: number; count: number; pending: number } }
  >({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  /** Pure fetch: returns the ready/error state, never calls setState. */
  async function fetchData(): Promise<
    | { kind: "error"; message: string }
    | { kind: "ready"; orders: OrderRow[]; totals: { paid: number; count: number; pending: number } }
  > {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: creator } = await supabase
        .from("creators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const creatorId = (creator as { id: string } | null)?.id;
      if (!creatorId) throw new Error("Create your brand kit first");

      // The hand-rolled Database type lacks Relationships keys, so embedded
      // joins don't type-check — fetch in parallel and stitch client-side.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ordersRes = await (supabase.from("orders") as any)
        .select("id, status, amount_cents, created_at, product_id, course_id, customer_id")
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(200);

      const rows = (ordersRes.data ?? []) as {
        id: string;
        status: OrderRow["status"];
        amount_cents: number;
        created_at: string;
        product_id: string | null;
        course_id: string | null;
        customer_id: string;
      }[];

      const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))] as string[];
      const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))] as string[];
      const customerIds = [...new Set(rows.map((r) => r.customer_id))];

      const [prodRes, courseRes, learnerRes] = await Promise.all([
        productIds.length
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase.from("products") as any).select("id, title").in("id", productIds)
          : Promise.resolve({ data: [] }),
        courseIds.length
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase.from("courses") as any).select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] }),
        customerIds.length
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase.from("learners") as any).select("id, email").in("id", customerIds)
          : Promise.resolve({ data: [] }),
      ]);

      const prodNames = new Map(((prodRes.data ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
      const courseNames = new Map(((courseRes.data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title]));
      const emails = new Map(((learnerRes.data ?? []) as { id: string; email: string }[]).map((l) => [l.id, l.email]));

      const orders: OrderRow[] = rows.map((r) => ({
        id: r.id,
        status: r.status,
        amount_cents: r.amount_cents,
        created_at: r.created_at,
        product_title: r.product_id ? prodNames.get(r.product_id) ?? null : null,
        course_title: r.course_id ? courseNames.get(r.course_id) ?? null : null,
        learner_email: emails.get(r.customer_id) ?? null,
      }));

      const paid = orders.filter((o) => o.status === "paid");
      return {
        kind: "ready" as const,
        orders,
        totals: {
          paid: paid.reduce((sum, o) => sum + o.amount_cents, 0),
          count: paid.length,
          pending: orders.filter((o) => o.status === "pending").reduce((s, o) => s + o.amount_cents, 0),
        },
      };
    } catch (e) {
      return { kind: "error" as const, message: e instanceof Error ? e.message : "Failed to load orders" };
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await fetchData();
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function load() {
    setRefreshing(true);
    setState(await fetchData());
    setRefreshing(false);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4 pb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Orders</h1>
          <p className="text-xs text-zinc-400">Sales from your published products &amp; courses.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {state.kind === "loading" ? (
        <p className="py-16 text-center text-sm text-zinc-400">Loading orders…</p>
      ) : state.kind === "error" ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{state.message}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 pb-5">
            <StatTile label="Revenue (paid)" value={formatPrice(state.totals.paid)} accent />
            <StatTile label="Paid orders" value={String(state.totals.count)} />
            <StatTile label="Pending" value={formatPrice(state.totals.pending)} />
          </div>

          {state.orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-10 text-center">
              <ShoppingBag className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-3 text-sm text-zinc-500">
                No orders yet. Publish items and share your storefront link — sales land here
                automatically once a customer checks out.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Item</th>
                    <th className="px-4 py-2.5 font-semibold">Customer</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {state.orders.map((o) => (
                    <tr key={o.id} className="text-zinc-700">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {o.course_title || o.product_title || "Order"}
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-400">
                          {o.course_title ? "course" : "product"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{o.learner_email ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(o.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatPrice(o.amount_cents)}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge
                          variant={o.status === "paid" ? "default" : o.status === "pending" ? "secondary" : "outline"}
                          className={cn(o.status === "paid" && "bg-emerald-600 hover:bg-emerald-600")}
                        >
                          {o.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        accent ? "border-transparent bg-gradient-brand text-white" : "border-zinc-200 bg-white"
      )}
    >
      <div className="flex items-center gap-1.5">
        {accent ? <TrendingUp className="h-3.5 w-3.5 opacity-80" /> : null}
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", accent ? "text-white/80" : "text-zinc-400")}>
          {label}
        </p>
      </div>
      <p className={cn("mt-1 text-2xl font-bold tracking-tight", accent ? "text-white" : "text-zinc-900")}>{value}</p>
    </div>
  );
}
