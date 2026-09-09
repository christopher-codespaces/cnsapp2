"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCap, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

/**
 * Masthead account control for public storefront pages. Signed out → a
 * "Sign in" link into the buyer auth page (which returns the visitor to this
 * storefront). Signed in → avatar + a small menu (My learning / Sign out).
 */
export default function AccountButton() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) {
          setSession(session);
          setChecking(false);
        }
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, s) => {
          if (!cancelled) setSession(s);
        });
        unsub = () => subscription.unsubscribe();
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Close the menu on outside clicks.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function signOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
  }

  if (checking) {
    return <span className="h-8 w-16 animate-pulse rounded-full bg-zinc-100" />;
  }

  if (!session) {
    const next = typeof window !== "undefined" ? window.location.pathname : "/";
    return (
      <Link
        href={`/auth/buyer?next=${encodeURIComponent(next)}`}
        className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        Sign in
      </Link>
    );
  }

  const email = session.user?.email ?? "";
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pl-1 pr-3 transition hover:border-zinc-300 hover:bg-zinc-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white uppercase">
          {email[0] ?? "?"}
        </span>
        <span className="max-w-[140px] truncate text-xs font-medium text-zinc-700">{email}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            role="menuitem"
          >
            <GraduationCap className="h-4 w-4 text-zinc-400" />
            My learning
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            role="menuitem"
          >
            <LogOut className="h-4 w-4 text-zinc-400" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
