"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, BookOpen, FileText, Users, Store } from "lucide-react";

type Stats = {
  brandName: string | null;
  storefrontPublished: boolean;
  products: number;
  courses: number;
  landingPages: number;
  subscribers: number;
};

const FALLBACK: Stats = {
  brandName: null,
  storefrontPublished: false,
  products: 0,
  courses: 0,
  landingPages: 0,
  subscribers: 0,
};

export default function Stats() {
  const [stats, setStats] = useState<Stats>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: creator } = await supabase
          .from("creators")
          .select("id, brand_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!creator) return;
        const c = creator as unknown as { id: string; brand_name: string };
        const [prod, course, lp, sub, sf] = await Promise.all([
          supabase.from("products").select("id", { count: "exact", head: true }).eq("creator_id", c.id),
          supabase.from("courses").select("id", { count: "exact", head: true }).eq("creator_id", c.id),
          supabase.from("landing_pages").select("id", { count: "exact", head: true }).eq("creator_id", c.id),
          supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("creator_id", c.id),
          supabase.from("storefronts").select("is_published").eq("creator_id", c.id).maybeSingle(),
        ]);
        if (cancelled) return;
        setStats({
          brandName: c.brand_name,
          storefrontPublished: (sf.data as unknown as { is_published: boolean } | null)?.is_published ?? false,
          products: prod.count ?? 0,
          courses: course.count ?? 0,
          landingPages: lp.count ?? 0,
          subscribers: sub.count ?? 0,
        });
      } catch {
        // Keep zeros — the dashboard still works without stats.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tiles = [
    { icon: Store, label: "Storefront", value: stats.storefrontPublished ? "Live" : "Draft", tone: "invert" },
    { icon: ShoppingBag, label: "Products", value: stats.products },
    { icon: BookOpen, label: "Courses", value: stats.courses },
    { icon: FileText, label: "Landing pages", value: stats.landingPages },
    { icon: Users, label: "Subscribers", value: stats.subscribers },
  ];

  return (
    <div className={loaded ? "grid gap-3 sm:grid-cols-3 lg:grid-cols-5" : "grid gap-3 sm:grid-cols-3 lg:grid-cols-5"}>
      {tiles.map((t) => (
        <div
          key={t.label}
          className={
            t.tone === "invert"
              ? "flex items-center gap-3 rounded-xl bg-gradient-brand p-4 text-white shadow-sm"
              : "flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          }
        >
          <span
            className={
              t.tone === "invert"
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500"
            }
          >
            <t.icon className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <span className={`block text-lg font-semibold leading-tight ${t.tone === "invert" ? "text-white" : "text-zinc-900"}`}>
              {typeof t.value === "number" ? t.value.toLocaleString() : t.value}
            </span>
            <span className={`block truncate text-xs ${t.tone === "invert" ? "text-white/80" : "text-zinc-400"}`}>
              {t.label}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}