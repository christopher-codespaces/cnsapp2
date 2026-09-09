"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Store, BookOpen, FileText } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async () => {
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hero-glow relative hidden flex-col justify-between overflow-hidden border-r border-zinc-100 bg-zinc-950 p-10 lg:flex">
          <div className="bg-grid-faint pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white shadow-sm">
              C
            </span>
            <span className="text-sm font-semibold text-white">CNS Creator OS</span>
          </div>
          <div className="relative max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Welcome back, creator
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-white">
              Your business is{" "}
              <span className="font-display italic text-gradient">waiting for you.</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Pick up where you left off — your storefront, courses, landing pages and AI
              conversations are all right here.
            </p>
            <div className="mt-8 flex flex-col gap-2.5">
              <Feature icon={Store} text="Storefront, products & landing pages" />
              <Feature icon={BookOpen} text="Courses with video lessons" />
              <Feature icon={FileText} text="AI copilot that knows your brand" />
            </div>
          </div>
          <p className="relative text-xs text-zinc-500">
            Built for creators who ship. © {new Date().getFullYear()}
          </p>
        </div>

        {/* Form side */}
        <div className="flex items-center justify-center bg-zinc-50 px-4 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-7 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white">
                C
              </span>
              <span className="text-sm font-semibold text-zinc-900">CNS Creator OS</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Sign in</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Welcome back — let&rsquo;s keep building.
            </p>
            {error && (
              <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                login();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="mt-1 w-full bg-zinc-900 hover:bg-zinc-700"
              >
                {loading ? "Signing in…" : "Sign in"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-zinc-500">
              Don&rsquo;t have an account?{" "}
              <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Store; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-zinc-200">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm text-zinc-300">{text}</span>
    </div>
  );
}