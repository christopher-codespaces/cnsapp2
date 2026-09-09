import { NextResponse } from "next/server";
import { getAdminClient, verifyTransaction } from "@/lib/paystack";
import { fulfillOrder } from "@/lib/fulfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/paystack/verify?reference=…
 *
 * Callback-time verification + fulfillment fallback. Paystack webhooks cannot
 * reach localhost during development, so when the buyer returns to /thanks the
 * client pings this endpoint: it verifies the transaction server-side with
 * Paystack and fulfills idempotently (the webhook remains the primary path in
 * production — both share the same fulfillment function).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reference = (searchParams.get("reference") ?? "").trim();
  if (!reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }

  const verified = await verifyTransaction(reference);
  if (!verified) {
    return NextResponse.json({ error: "Could not verify this payment" }, { status: 502 });
  }
  if (verified.status !== "success") {
    return NextResponse.json({ status: verified.status }, { status: 402 });
  }

  const meta = verified.metadata as {
    kind?: string;
    item_id?: string;
    creator_id?: string;
    learner_id?: string;
    amount_cents?: string;
  };
  const kind = meta.kind === "course" ? "course" : meta.kind === "product" ? "product" : null;

  if (!kind || !meta.item_id || !meta.learner_id || !meta.creator_id) {
    return NextResponse.json({ error: "Payment metadata is incomplete" }, { status: 422 });
  }

  const result = await fulfillOrder(admin, {
    reference,
    kind,
    itemId: meta.item_id,
    learnerId: meta.learner_id,
    creatorId: meta.creator_id,
    amountCents: meta.amount_cents ? Number(meta.amount_cents) : verified.amountKobo,
    gateway: "paystack",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ status: "success", order: result.orderStatus });
}
