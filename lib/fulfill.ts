// =============================================================================
// CNS Creator OS — Paystack order fulfillment (server-only)
// -----------------------------------------------------------------------------
// One shared, idempotent fulfillment path used by BOTH the webhook and the
// /thanks callback verification (webhooks can't reach localhost during local
// dev, so the returning browser verifies + fulfills as a fallback).
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function from(admin: SupabaseClient, table: string): any {
  // The hand-rolled Database type lacks Relationships keys, so the typed
  // builder resolves to `never` — access goes through `any` on purpose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (admin as any).from(table);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Query results arrive untyped from the REST layer; shape them here. */
function q<T = unknown>(p: any): Promise<{ data: T | null; error: { message: string } | null }> {
  return p;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface FulfillInput {
  reference: string;
  kind: "product" | "course";
  itemId: string;
  learnerId: string;
  creatorId: string;
  amountCents: number;
  gateway: "paystack";
}

export type FulfillResult =
  | { ok: true; orderStatus: "paid" | "already-paid" }
  | { ok: false; error: string };

/**
 * Mark the pending order paid, enroll for courses, and record the sale event.
 * Idempotent: the pending→paid transition happens at most once, and repeat
 * calls short-circuit to "already-paid".
 */
export async function fulfillOrder(
  admin: SupabaseClient,
  input: FulfillInput
): Promise<FulfillResult> {
  // 1. Find the pending order by its gateway reference.
  const { data: pending } = await q<{ id: string }[]>(
    from(admin, "orders").select("id").eq("stripe_payment_id", input.reference).eq("status", "pending").limit(1)
  );

  if (pending && pending.length) {
    const { error } = await q(
      from(admin, "orders").update({ status: "paid", amount_cents: input.amountCents }).eq("id", pending[0].id).eq("status", "pending")
    );
    if (error) return { ok: false, error: error.message };
  } else {
    // No pending row with this reference: either already fulfilled (fine) or
    // the checkout-time insert failed (heal by inserting a paid order).
    const { data: existing } = await q<{ id: string }[]>(
      from(admin, "orders").select("id").eq("stripe_payment_id", input.reference).limit(1)
    );
    if (!existing || !existing.length) {
      const { error } = await q(
        from(admin, "orders").insert({
          creator_id: input.creatorId,
          customer_id: input.learnerId,
          product_id: input.kind === "product" ? input.itemId : null,
          course_id: input.kind === "course" ? input.itemId : null,
          amount_cents: input.amountCents,
          status: "paid",
          stripe_payment_id: input.reference,
        })
      );
      if (error) return { ok: false, error: error.message };
    }
  }

  // 2. Enroll for courses (idempotent upsert).
  if (input.kind === "course") {
    const { error } = await q(
      from(admin, "enrollments")
        .upsert(
          { course_id: input.itemId, learner_id: input.learnerId, source: "checkout" },
          { onConflict: "course_id,learner_id" }
        )
    );
    if (error) return { ok: false, error: error.message };
  }

  // 3. Sale analytics event (best-effort).
  await q(
    from(admin, "analytics_events").insert({
      creator_id: input.creatorId,
      event_type: "sale",
      metadata: {
        kind: input.kind,
        item_id: input.itemId,
        gateway: input.gateway,
        reference: input.reference,
        amount_cents: input.amountCents,
      },
    })
  );

  return { ok: true, orderStatus: pending && pending.length ? "paid" : "already-paid" };
}
