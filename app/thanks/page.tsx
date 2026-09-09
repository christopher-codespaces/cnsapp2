import Link from "next/link";
import { CheckCircle2, GraduationCap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import VerifyPurchase from "@/components/storefront/VerifyPurchase";

export const dynamic = "force-dynamic";

/**
 * Post-purchase confirmation. Checkout redirects here with
 * ?course=<id>&email=…&reference=… (or ?product=…). Courses get an "Open your
 * course" CTA straight into the student player. When a Paystack reference is
 * present, VerifyPurchase confirms server-side (fulfillment fallback while
 * webhooks can't reach localhost).
 */
export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; product?: string; email?: string; reference?: string }>;
}) {
  const sp = await searchParams;
  const kind = sp.course ? "course" : sp.product ? "product" : null;
  const email = (sp.email ?? "").trim();
  const reference = (sp.reference ?? "").trim();

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-6 py-24">
      <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
          {kind === "course" ? "You're enrolled!" : "Order confirmed!"}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {email ? (
            <>
              A confirmation is on its way to <span className="font-medium text-zinc-700">{email}</span>.
            </>
          ) : (
            "Thanks for your purchase."
          )}
        </p>

        {reference ? <VerifyPurchase reference={reference} /> : null}

        {kind === "course" && email ? (
          <>
            <Button asChild className="mt-6 w-full">
              <Link
                href={`/learn?course=${sp.course}&email=${encodeURIComponent(email)}`}
              >
                <GraduationCap className="h-4 w-4" />
                Open your course
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-zinc-400">
              Bookmark this link — it&rsquo;s your access to the course.
            </p>
          </>
        ) : null}

        {email ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
            <p className="text-xs font-medium text-zinc-900">Keep your purchase forever</p>
            <p className="mt-0.5 text-xs text-zinc-600">
              Create a password for <span className="font-medium">{email}</span> — your courses
              follow you on any device.
            </p>
            <Link
              href={`/auth/buyer?mode=signup&email=${encodeURIComponent(email)}&next=/account`}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
            >
              Create my account
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col items-center gap-2 text-xs">
          {email ? (
            <Link
              href={`/orders?email=${encodeURIComponent(email)}`}
              className="font-medium text-zinc-600 underline hover:text-zinc-900"
            >
              View all your orders
            </Link>
          ) : null}
          <Link href="/" className="text-zinc-400 underline hover:text-zinc-600">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
