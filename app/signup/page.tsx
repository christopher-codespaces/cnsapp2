"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Rocket, Wand2, PenLine } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const signup = async () => {
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
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
              For creators who ship
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-white">
              Turn your ideas into{" "}
              <span className="font-display italic text-gradient">real products.</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              One workspace to build your storefront, land your audience, sell your products and
              teach your courses — with an AI copilot that knows your brand.
            </p>
            <div className="mt-8 flex flex-col gap-2.5">
              <Feature icon={PenLine} step="01" text="Describe what you want in plain language" />
              <Feature icon={Wand2} step="02" text="The AI drafts copy, pages and outlines for you" />
              <Feature icon={Rocket} step="03" text="Publish under your own handle — no code" />
            </div>
          </div>
          <p className="relative text-xs text-zinc-500">
            Free to start. Built for creators who ship. © {new Date().getFullYear()}
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
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Create your account</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Start building in minutes. No credit card needed.
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
                signup();
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
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="mt-1 w-full bg-zinc-900 hover:bg-zinc-700"
              >
                {loading ? "Creating account…" : "Create account"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-zinc-900 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  step,
  text,
}: {
  icon: typeof PenLine;
  step: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-zinc-200">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm text-zinc-300">
        <span className="font-semibold text-zinc-100">{step}</span> · {text}
      </span>
    </div>
  );
}