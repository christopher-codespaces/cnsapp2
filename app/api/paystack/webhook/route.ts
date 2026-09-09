import { NextResponse } from "next/server";
import { getAdminClient, verifyWebhookSignature } from "@/lib/paystack";
import { fulfillOrder } from "@/lib/fulfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/paystack/webhook
 *
 * Paystack event delivery. We verify the HMAC-SHA512 signature against the
 * RAW body, then handle charge.success through the shared idempotent
 * fulfillment path (order → paid, enrollment, sale analytics event).
 *
 * Register this URL in the Paystack dashboard (Settings → Webhooks) for the
 * charge.success event. In local dev, use `paystack CLI` or the callback
 * verification fallback on /thanks.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const ok = await verifyWebhookSignature(rawBody, signature);
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
      status?: string;
      metadata?: Record<string, unknown>;
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true, ignored: event.event ?? "unknown" });
  }

  const d = event.data;
  const meta = (d?.metadata ?? {}) as {
    kind?: string;
    item_id?: string;
    creator_id?: string;
    learner_id?: string;
    amount_cents?: string;
  };
  const kind = meta.kind === "course" ? "course" : meta.kind === "product" ? "product" : null;
  const amountCents = typeof meta.amount_cents === "string" ? Number(meta.amount_cents) : d?.amount ?? 0;

  if (!d?.reference || !kind || !meta.item_id || !meta.learner_id || !meta.creator_id) {
    console.error("paystack webhook: incomplete charge.success", d?.reference, meta);
    return NextResponse.json({ received: true, skipped: "incomplete metadata" });
  }

  // Trust but verify: confirm the transaction really succeeded server-side.
  const { verifyTransaction } = await import("@/lib/paystack");
  const verified = await verifyTransaction(d.reference);
  if (!verified || verified.status !== "success") {
    console.error("paystack webhook: verify did not confirm success", d.reference, verified?.status);
    return NextResponse.json({ received: true, skipped: "verify failed" });
  }

  const result = await fulfillOrder(admin, {
    reference: d.reference,
    kind,
    itemId: meta.item_id,
    learnerId: meta.learner_id,
    creatorId: meta.creator_id,
    amountCents: Number.isFinite(amountCents) ? amountCents : verified.amountKobo,
    gateway: "paystack",
  });

  if (!result.ok) {
    console.error("paystack webhook fulfillment failed", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ received: true, order: result.orderStatus });
}
