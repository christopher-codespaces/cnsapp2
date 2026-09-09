"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Sign-out button for buyer-facing pages (server components can't call auth). */
export default function BuyerSignOut({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signOut() {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className={
        className ??
        "rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60"
      }
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign out"}
    </button>
  );
}
