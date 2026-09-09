"use client";

import { useEffect, useState } from "react";
import { Eye, TrendingUp, Users, GraduationCap, Loader2, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

interface Bucket {
  page_view: number;
  sale: number;
  signup: number;
  enrollment: number;
  revenue_cents: number;
  buyers: number;
}

/**
 * Creator analytics (Phase 6): aggregate views / signups / sales from
 * `analytics_events` (owner RLS) plus enrollment counts from `enrollments`
 * via the creator's courses. Aggregations happen client-side — event volume
 * per creator is small at this stage; can move to a SQL view later.
 */
export default function AnalyticsPage() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; bucket: Bucket; recent: { id: string; event_type: string; created_at: string; metadata: Record<string, unknown> }[] }
  >({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  /** Pure fetch: returns the ready/error state, never calls setState. */
  async function fetchData(): Promise<
    | { kind: "error"; message: string }
    | { kind: "ready"; bucket: Bucket; recent: { id: string; event_type: string; created_at: string; metadata: Record<string, unknown> }[] }
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

      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

       
      const [eventsRes, coursesRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("analytics_events") as any)
          .select("id, event_type, metadata, created_at")
          .eq("creator_id", creatorId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(2000),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("enrollments") as any)
          .select("id, course_id, learner_id, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (eventsRes.error) throw eventsRes.error;

      const events = (eventsRes.data ?? []) as {
        id: string;
        event_type: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }[];

      // Enrollments filtered to this creator's courses.
      const { data: myCourses } = await supabase.from("courses").select("id").eq("creator_id", creatorId);
      const myCourseIds = new Set(((myCourses ?? []) as { id: string }[]).map((c) => c.id));
      const myEnrollments = ((coursesRes.data ?? []) as { course_id: string; created_at: string }[]).filter(
        (e) => myCourseIds.has(e.course_id)
      );

      const bucket: Bucket = {
        page_view: 0,
        sale: 0,
        signup: 0,
        enrollment: 0,
        revenue_cents: 0,
        buyers: 0,
      };
      const buyers = new Set<string>();
      for (const e of events) {
        if (e.event_type === "page_view") bucket.page_view += 1;
        else if (e.event_type === "signup") bucket.signup += 1;
        else if (e.event_type === "sale") {
          bucket.sale += 1;
          buyers.add(String((e.metadata as { reference?: string } | null)?.reference ?? e.id));
          bucket.revenue_cents += Number((e.metadata as { amount_cents?: number } | null)?.amount_cents ?? 0);
        }
      }
      bucket.enrollment = myEnrollments.filter((e) => e.created_at >= since).length;

      return { kind: "ready" as const, bucket, recent: events.slice(0, 12) };
    } catch (e) {
      return { kind: "error" as const, message: e instanceof Error ? e.message : "Failed to load analytics" };
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
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Analytics</h1>
          <p className="text-xs text-zinc-400">Last 30 days across your published pages.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {state.kind === "loading" ? (
        <p className="py-16 text-center text-sm text-zinc-400">Loading analytics…</p>
      ) : state.kind === "error" ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{state.message}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile icon={Eye} label="Page views" value={String(state.bucket.page_view)} />
            <Tile icon={Users} label="Email signups" value={String(state.bucket.signup)} />
            <Tile icon={GraduationCap} label="New enrollments" value={String(state.bucket.enrollment)} />
            <Tile icon={TrendingUp} label="Sales" value={String(state.bucket.sale)} accent sub={formatPrice(state.bucket.revenue_cents)} />
          </div>

          <h2 className="mt-8 pb-2 text-sm font-semibold text-zinc-900">Recent activity</h2>
          {state.recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-10 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-3 text-sm text-zinc-500">
                No activity yet. Share your storefront link — views, signups, and sales show up here.
              </p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
              {state.recent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <EventDot type={e.event_type} />
                  <span className="font-medium capitalize text-zinc-800">{e.event_type.replace("_", " ")}</span>
                  <span className="text-zinc-400 truncate">
                    {typeof (e.metadata as { path?: string } | null)?.path === "string"
                      ? (e.metadata as { path: string }).path
                      : ""}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-zinc-400">
                    {new Date(e.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        accent ? "border-transparent bg-gradient-brand text-white" : "border-zinc-200 bg-white"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", accent ? "opacity-80" : "text-zinc-400")} />
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", accent ? "text-white/80" : "text-zinc-400")}>
          {label}
        </p>
      </div>
      <p className={cn("mt-1 text-2xl font-bold tracking-tight", accent ? "text-white" : "text-zinc-900")}>
        {value}
        {sub ? <span className={cn("ml-2 text-sm font-medium", accent ? "text-white/80" : "text-zinc-400")}>{sub}</span> : null}
      </p>
    </div>
  );
}

function EventDot({ type }: { type: string }) {
  const color =
    type === "sale"
      ? "bg-emerald-500"
      : type === "page_view"
        ? "bg-zinc-300"
        : type === "signup"
          ? "bg-sky-500"
          : "bg-amber-500";
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />;
}
