"use client";

import { useEffect } from "react";

/**
 * Fires one anonymous `page_view` analytics event when a published storefront
 * loads. Rendered only by the public /c/[handle] page. The insert is gated by
 * RLS to published storefronts, so this can never track unpublished drafts.
 */
export default function PageViewTracker({ creatorId }: { creatorId: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("analytics_events") as any).insert({
          creator_id: creatorId,
          event_type: "page_view",
          metadata: { path: window.location.pathname, ref: document.referrer || null },
        });
      } catch {
        // tracking must never break the page
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  return null;
}
