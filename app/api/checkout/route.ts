import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminClient, initializeTransaction, appOrigin } from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/checkout  { kind: "product" | "course", id, email }
 *
 * Starts a Paystack checkout for a published product/course:
 *  - re-reads the price with the service role (client never supplies amounts),
 *  - upserts the learner (email-unique),
 *  - seeds a pending order with a unique reference,
 *  - initializes the Paystack transaction and returns its authorization_url.
 *
 * Free items (price 0) skip Paystack entirely: the order is marked paid, the
 * learner is enrolled (courses), and the browser goes straight to /thanks.
 */
export async function POST(req: Request) {
  let body: { kind?: string; id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = body.kind === "course" ? "course" : body.kind === "product" ? "product" : null;
  const id = typeof body.id === "string" ? body.id : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!kind || !id) {
    return NextResponse.json({ error: "kind (product|course) and id are required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for payments" }, { status: 500 });
  }

  // Read the item with the service role so price/creator come from the DB.
  // Only PUBLISHED items can be bought.
  const table = kind === "course" ? "courses" : "products";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: itemError } = await (admin.from(table) as any)
    .select("id, title, price_cents, creator_id, is_published")
    .eq("id", id)
    .maybeSingle();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (!item.is_published) {
    return NextResponse.json({ error: "This item is not available" }, { status: 403 });
  }

  const amountCents = typeof item.price_cents === "number" ? item.price_cents : 0;

  // Upsert the learner (email-unique) so fulfillment and free enrollment have
  // a learner row immediately.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: learner, error: learnerError } = await (admin.from("learners") as any)
    .upsert({ email }, { onConflict: "email" })
    .select("id")
    .single();
  if (learnerError || !learner) {
    console.error("learner upsert failed", learnerError);
    // Surface the DB detail in dev so setup gaps (e.g. missing grants) are
    // debuggable from the browser; stay generic in production.
    return NextResponse.json(
      {
        error: "Could not start checkout",
        ...(process.env.NODE_ENV !== "production" && learnerError?.message
          ? { detail: learnerError.message }
          : {}),
      },
      { status: 500 }
    );
  }
  const learnerId = (learner as { id: string }).id;

  const orderPayload = {
    creator_id: item.creator_id,
    customer_id: learnerId,
    product_id: kind === "product" ? item.id : null,
    course_id: kind === "course" ? item.id : null,
    amount_cents: amountCents,
    status: "pending" as const,
  };

  // Free items: mark paid + enroll now, no Paystack round-trip.
  if (amountCents <= 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from("orders") as any)
      .insert({ ...orderPayload, status: "paid", stripe_payment_id: null })
      .select("id")
      .single();
    if (error) console.error("free order insert failed", error);
    if (kind === "course") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: enrollError } = await (admin.from("enrollments") as any).upsert(
        { course_id: item.id, learner_id: learnerId, source: "checkout" },
        { onConflict: "course_id,learner_id" }
      );
      if (enrollError) console.error("free enrollment failed", enrollError);
    }
    return NextResponse.json({
      url: `/thanks?${kind}=${item.id}&email=${encodeURIComponent(email)}`,
    });
  }

  // Seed the pending order first; the reference ties it to Paystack.
  const reference = `cns-${Date.now()}-${randomBytes(6).toString("hex")}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: orderError } = await (admin.from("orders") as any)
    .insert({ ...orderPayload, stripe_payment_id: reference })
    .select("id")
    .single();
  if (orderError) {
    console.error("pending order insert failed (grants applied?)", orderError);
    return NextResponse.json(
      {
        error: "Could not start checkout",
        ...(process.env.NODE_ENV !== "production" && orderError.message ? { detail: orderError.message } : {}),
      },
      { status: 500 }
    );
  }

  try {
    const { authorizationUrl } = await initializeTransaction({
      email,
      // Paystack amounts are in the smallest unit — same cents/kobo figure
      // the app stores everywhere.
      amountKobo: amountCents,
      reference,
      callbackUrl: `${appOrigin(req)}/thanks?${kind}=${item.id}&email=${encodeURIComponent(email)}&reference=${reference}`,
      metadata: { kind, item_id: item.id, creator_id: item.creator_id, learner_id: learnerId, amount_cents: String(amountCents) },
    });
    return NextResponse.json({ url: authorizationUrl });
  } catch (e) {
    console.error("paystack initialize failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start checkout" },
      { status: 502 }
    );
  }
}
