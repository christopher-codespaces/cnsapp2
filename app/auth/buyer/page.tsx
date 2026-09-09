"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";

/**
 * Buyer auth (/auth/buyer). One page, two modes:
 *  - ?mode=signup (or the "Create account" toggle) — creates the account.
 *    Supabase is configured to auto-confirm, so the session is live instantly.
 *  - default — sign in.
 * ?next=/c/john-create returns the buyer where they came from. After auth the
 * buyer lands on their /account dashboard (or ?next).
 */
export default function BuyerAuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-50">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </main>
      }
    >
      <BuyerAuthForm />
    </Suspense>
  );
}

function BuyerAuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/account";
  const initialMode: Mode = params.get("mode") === "signup" ? "signup" : "signin";
  const prefillEmail = params.get("email") ?? "";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in? Straight to the account.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session) router.replace(next);
      } catch {
        /* not signed in — stay */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  function done() {
    router.push(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          done(); // auto-confirm enabled — session is live
        } else {
          // Email confirmation required by project settings.
          setNotice("Account created! Check your inbox to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        done();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-brand text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-center text-xl font-bold tracking-tight text-zinc-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-center text-sm text-zinc-500">
            {isSignup
              ? "Your purchases and courses live here — across every creator."
              : "Sign in to see your courses and orders."}
          </p>

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {notice}
            </p>
          ) : null}

          <form onSubmit={submit} className="mt-5 flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="buyer-email">Email</Label>
              <Input
                id="buyer-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="buyer-password">Password</Label>
              <Input
                id="buyer-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSignup ? "Create account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-zinc-500">
            {isSignup ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? "signin" : "signup");
                setError(null);
                setNotice(null);
              }}
              className="font-medium text-zinc-900 hover:underline"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          One account works on every storefront built with CNS.{" "}
          <Link href="/" className="underline hover:text-zinc-600">
            Home
          </Link>
        </p>
      </div>
    </main>
  );
}
