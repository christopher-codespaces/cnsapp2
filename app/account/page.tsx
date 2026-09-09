import Link from "next/link";
import {
  GraduationCap,
  ArrowRight,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StudentOrders from "@/components/orders/StudentOrders";
import BuyerSignOut from "@/components/auth/BuyerSignOut";

export const dynamic = "force-dynamic";

/** The hand-rolled Database type lacks the student tables — same escape hatch lib/access.ts uses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

interface AccountOrder {
  id: string;
  status: string;
  amount_cents: number;
  created_at: string;
  kind: "product" | "course";
  item_title: string;
  learn_url: string | null;
}

interface AccountCourse {
  id: string;
  title: string;
  learn_url: string;
}

/**
 * The signed-in buyer's dashboard (/account). Resolved server-side from the
 * auth session: the learners row linked to the account owns orders +
 * enrollments (RLS-verified), so this shows exactly what the buyer owns.
 * Signed-out visitors get the email-gate view (their /orders fallback).
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Guest → the email-gate experience still works (e.g. buyers who checked
  // out before accounts existed and never claimed one).
  if (!session) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
        <div className="mx-auto max-w-3xl px-6 pt-10">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You&rsquo;re browsing as a guest.{" "}
            <Link
              href="/auth/buyer?next=/account"
              className="font-semibold underline hover:text-amber-900"
            >
              Sign in or create an account
            </Link>{" "}
            to keep your courses on any device — or look up your orders by email below.
          </div>
        </div>
        <StudentOrders />
      </main>
    );
  }

  const email = session.user?.email ?? "";
  const authUserId = session.user?.id ?? "";

  // The learner linked to this account (created by the signup trigger), and
  // their purchases. RLS scopes every query to the signed-in buyer anyway.
  const { data: learner } = await (supabase.from("learners") as AnyTable)
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  const learnerId = (learner as { id: string } | null)?.id;

  let orders: AccountOrder[] = [];
  let courses: AccountCourse[] = [];

  if (learnerId) {
    const [orderRes, enrollRes] = await Promise.all([
      (supabase.from("orders") as AnyTable)
        .select("id, status, amount_cents, created_at, product_id, course_id")
        .eq("customer_id", learnerId)
        .order("created_at", { ascending: false })
        .limit(100),
      (supabase.from("enrollments") as AnyTable)
        .select("course_id")
        .eq("learner_id", learnerId),
    ]);

    const rows = (orderRes.data ?? []) as {
      id: string;
      status: string;
      amount_cents: number;
      created_at: string;
      product_id: string | null;
      course_id: string | null;
    }[];
    const enrolledIds = ((enrollRes.data ?? []) as { course_id: string }[]).map((e) => e.course_id);

    const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))] as string[];
    const courseIds = [
      ...new Set([...rows.map((r) => r.course_id).filter(Boolean), ...enrolledIds]),
    ] as string[];

    const [prodRes, courseRes] = await Promise.all([
      productIds.length
        ? (supabase.from("products") as AnyTable).select("id, title").in("id", productIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      courseIds.length
        ? (supabase.from("courses") as AnyTable).select("id, title").in("id", courseIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);

    const titles = new Map<string, string>([
      ...(((prodRes.data ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title] as const)),
      ...(((courseRes.data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title] as const)),
    ]);

    orders = rows.map((r) => {
      const isCourse = Boolean(r.course_id);
      const itemId = (r.course_id ?? r.product_id) as string | null;
      const canOpen =
        isCourse && r.status === "paid" && r.course_id !== null && enrolledIds.includes(r.course_id);
      return {
        id: r.id,
        status: r.status,
        amount_cents: r.amount_cents,
        created_at: r.created_at,
        kind: isCourse ? "course" : "product",
        item_title: (itemId ? titles.get(itemId) : null) ?? (isCourse ? "Course" : "Product"),
        learn_url:
          canOpen && r.course_id
            ? `/learn?course=${r.course_id}&email=${encodeURIComponent(email)}`
            : null,
      };
    });

    courses = enrolledIds.map((cid) => ({
      id: cid,
      title: titles.get(cid) ?? "Course",
      learn_url: `/learn?course=${cid}&email=${encodeURIComponent(email)}`,
    }));
  }

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      {/* Masthead */}
      <header className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white shadow-sm">
              C
            </span>
            <span className="text-sm font-semibold text-zinc-900">My learning</span>
          </Link>
          <BuyerSignOut />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Hey{email ? `, ${email.split("@")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Everything you&rsquo;ve bought, across every creator — in one place.
        </p>

        {courses.length ? (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Your courses
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {courses.map((c) => (
                <a
                  key={c.id}
                  href={c.learn_url}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <GraduationCap className="h-4 w-4" />
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
          {orders.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-3 text-sm text-zinc-500">No purchases yet.</p>
              <p className="mt-1 text-xs text-zinc-400">
                Anything you buy on a creator storefront will show up here automatically.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              {orders.map((o) => (
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
                    {o.amount_cents > 0 ? `$${(o.amount_cents / 100).toFixed(2)}` : "Free"}
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
    </main>
  );
}
