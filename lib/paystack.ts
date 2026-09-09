// =============================================================================
// CNS Creator OS — Paystack + service-role Supabase (server-only)
// -----------------------------------------------------------------------------
// Used exclusively by the checkout API and the Paystack webhook. Everything is
// lazy: modules import cleanly even when keys are missing, and the APIs return
// clear "not configured" errors.
//
// Configure via .env:
//   PAYSTACK_SECRET_KEY            sk_test_… / sk_live_…
//   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY  pk_test_… / pk_live_… (checkout widget)
// =============================================================================

import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const PAYSTACK_BASE = "https://api.paystack.co";

let adminSingleton: SupabaseClient<Database> | null = null;

/**
 * Service-role Supabase client (bypasses RLS). Server-only — used by the
 * webhook to create learners/enrollments and by checkout to seed pending
 * orders. Returns null when SUPABASE_SERVICE_ROLE_KEY is unset.
 */
export function getAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!adminSingleton) {
    adminSingleton = createSupabaseClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminSingleton;
}

export function paystackSecretKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null;
}

/** Absolute origin of this deployment, for Paystack callbacks. */
export function appOrigin(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export interface InitializeResult {
  authorizationUrl: string;
  reference: string;
}

/**
 * Initialize a Paystack transaction. Amount is in the currency's smallest
 * unit (kobo for NGN/GHS, cents for USD). `metadata` round-trips through the
 * webhook and is also embedded in the reference for belt-and-braces
 * fulfillment lookup.
 */
export async function initializeTransaction({
  email,
  amountKobo,
  reference,
  callbackUrl,
  metadata,
}: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeResult> {
  const secret = paystackSecretKey();
  if (!secret) throw new Error("Payments are not configured yet");

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl,
      metadata,
      currency: process.env.PAYSTACK_CURRENCY || "USD",
    }),
  });
  const j = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };
  if (!res.ok || !j.status || !j.data?.authorization_url) {
    throw new Error(j.message || `Paystack initialize failed (${res.status})`);
  }
  return { authorizationUrl: j.data.authorization_url, reference: j.data.reference ?? reference };
}

export interface VerifyResult {
  status: "success" | "failed" | "abandoned" | "pending" | string;
  amountKobo: number;
  reference: string;
  paidAt: string | null;
  metadata: Record<string, unknown>;
}

/** Server-side verification — the source of truth for fulfillment. */
export async function verifyTransaction(reference: string): Promise<VerifyResult | null> {
  const secret = paystackSecretKey();
  if (!secret) return null;
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    status?: boolean;
    data?: { status?: string; amount?: number; reference?: string; paid_at?: string; metadata?: Record<string, unknown> };
  };
  const d = j.data;
  if (!j.status || !d) return null;
  return {
    status: d.status ?? "pending",
    amountKobo: d.amount ?? 0,
    reference: d.reference ?? reference,
    paidAt: d.paid_at ?? null,
    metadata: d.metadata ?? {},
  };
}

/**
 * Webhook authenticity check. Paystack signs the RAW body with
 * HMAC SHA-512 under x-paystack-signature.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = paystackSecretKey();
  if (!secret || !signature) return false;
  const { createHmac, timingSafeEqual } = await import("crypto");
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
