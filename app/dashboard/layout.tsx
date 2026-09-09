"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Store,
  FileText,
  ShoppingBag,
  BookOpen,
  Palette,
  LogOut,
  Sparkles,
  BarChart3,
  ReceiptText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/storefront", label: "Storefront", icon: Store, exact: false },
  { href: "/dashboard/ai", label: "AI workspace", icon: Sparkles, exact: false },
  { href: "/dashboard/products", label: "Products", icon: ShoppingBag, exact: false },
  { href: "/dashboard/courses", label: "Courses", icon: BookOpen, exact: false },
  { href: "/dashboard/orders", label: "Orders", icon: ReceiptText, exact: false },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, exact: false },
  { href: "/dashboard/landing-pages", label: "Landing pages", icon: FileText, exact: false },
  { href: "/dashboard/brand-kit", label: "Brand kit", icon: Palette, exact: false },
];

interface Unsubscribable {
  unsubscribe(): void;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let unsub: Unsubscribable | null = null;
    let cancelled = false;
    import("@/lib/supabase/client")
      .then(async ({ createClient }) => {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) setSession(session);
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!cancelled) setSession(session);
        });
        unsub = subscription;
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
      if (unsub) unsub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!checking && !session) {
      router.push("/login");
    }
  }, [checking, session, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Redirecting…</p>
      </div>
    );
  }

  async function signOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex bg-zinc-50">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white shadow-sm">
            C
          </span>
          <span className="text-sm font-semibold text-zinc-900 leading-tight">
            CNS Creator OS
          </span>
        </div>
        <p className="px-5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Workspace
        </p>
        <nav className="flex-1 space-y-0.5 px-2 py-1.5">
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-zinc-100 font-medium text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-orange-500" : "text-zinc-400 group-hover:text-zinc-600"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <div className="flex items-center gap-2 px-1 pb-2 min-w-0">
            <span className="h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-semibold text-zinc-600 uppercase shrink-0">
              {(session.user?.email || "?")[0]}
            </span>
            <span className="text-xs text-zinc-500 truncate">{session.user?.email}</span>
          </div>
          <Button variant="outline" size="sm" className="w-full text-zinc-600" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile nav */}
        <div className="md:hidden border-b border-zinc-200 bg-white px-4 py-2 flex items-center gap-1 overflow-x-auto">
          <span className="text-sm font-semibold text-zinc-900 mr-2">CNS</span>
          {NAV_ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
                  active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-500"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <header className="hidden md:flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
          <span className="text-sm text-zinc-400">{session.user?.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </header>
        <main className="flex-1 p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
