import StudentOrders from "@/components/orders/StudentOrders";

export const dynamic = "force-dynamic";

/**
 * Buyer dashboard (/orders). Email-gated order history across ALL creators —
 * the checkout email is the credential, resolved server-side through
 * /api/course-access. ?email=… (from the /thanks confirmation) skips the gate.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const sp = await searchParams;
  const prefillEmail = (sp.email ?? "").trim();

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <StudentOrders prefillEmail={prefillEmail} />
    </main>
  );
}
