import Link from "next/link";
import {
  Sparkles,
  Store,
  FileText,
  ShoppingBag,
  BookOpen,
  Palette,
  ArrowRight,
  PenLine,
  Wand2,
  Rocket,
} from "lucide-react";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#platform", label: "One platform" },
  { href: "#how", label: "How it works" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI workspace",
    body: "Chat with a copilot that reads your real brand, storefront and catalog — and helps you make everything better.",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    icon: Store,
    title: "Storefront",
    body: "A polished storefront with hero, video VSL, products, courses, testimonials and email capture — published under your handle.",
    gradient: "from-orange-400 to-rose-500",
  },
  {
    icon: FileText,
    title: "Landing pages",
    body: "Sales pages, waitlists, lead magnets and thank-you pages with a drag-and-drop block editor for every campaign.",
    gradient: "from-rose-400 to-pink-600",
  },
  {
    icon: ShoppingBag,
    title: "Digital products",
    body: "Ebooks, templates, memberships and more — with pricing, covers and delivery files ready for checkout.",
    gradient: "from-violet-400 to-purple-600",
  },
  {
    icon: BookOpen,
    title: "Courses",
    body: "A Kajabi-style course builder: outline your modules and lessons, upload videos, and teach like a pro.",
    gradient: "from-sky-400 to-indigo-600",
  },
  {
    icon: Palette,
    title: "Brand kit",
    body: "Your name, colors, voice and audience set once — reused consistently across every page you ship.",
    gradient: "from-emerald-400 to-teal-600",
  },
];

const REPLACES = [
  "Kajabi",
  "Stan Store",
  "Gumroad",
  "ClickFunnels",
  "Framer",
  "Notion",
];

const STEPS = [
  {
    icon: PenLine,
    title: "Describe",
    body: "Tell the AI what you're building in plain language — a product launch, a course, a lead magnet.",
  },
  {
    icon: Wand2,
    title: "Generate",
    body: "It drafts copy, structures pages and works with your brand voice and colors automatically.",
  },
  {
    icon: Rocket,
    title: "Publish",
    body: "Flip a switch and your storefront or landing page is live under your own handle. Ship in minutes.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white shadow-sm">
              C
            </span>
            <span className="text-sm font-semibold tracking-tight text-zinc-900">
              CNS Creator OS
            </span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-glow relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
              The all-in-one OS for modern creators
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
              Your whole creator business.
              <br />
              <span className="font-display italic text-gradient">One beautiful space.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-zinc-500 sm:text-lg">
              Build, launch, sell and teach — without ten different tools. An AI copilot that
              knows your brand builds your storefront, landing pages and courses with you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-700 hover:shadow-lg"
              >
                Start creating — it’s free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Product mock */}
          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="absolute -inset-x-8 -top-10 h-40 bg-gradient-to-r from-amber-300/20 via-rose-300/20 to-pink-300/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 hidden rounded-md bg-white px-2.5 py-0.5 text-[11px] text-zinc-400 ring-1 ring-zinc-200 sm:block">
                  cns.os/your-handle
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              </div>
              <div className="grid md:grid-cols-[220px_1fr]">
                {/* Fake sidebar */}
                <div className="hidden border-r border-zinc-100 bg-white p-3 md:block">
                  <p className="px-1.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Sections
                  </p>
                  {["Hero", "Video (VSL)", "About", "Products", "Courses", "Testimonials", "FAQ"].map(
                    (s, i) => (
                      <div
                        key={s}
                        className={
                          i === 0
                            ? "mb-0.5 flex items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white"
                            : "mb-0.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-500"
                        }
                      >
                        <span className={`h-2 w-2 rounded-sm ${i === 0 ? "bg-amber-400" : "bg-zinc-200"}`} />
                        {s}
                      </div>
                    )
                  )}
                </div>
                {/* Fake preview */}
                <div className="bg-zinc-50/60 p-6">
                  <div className="mx-auto max-w-md text-center">
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      New — cohort open
                    </span>
                    <p className="mt-3 font-display text-2xl italic tracking-tight text-zinc-900 sm:text-3xl">
                      Build the business your audience asks for
                    </p>
                    <div className="mx-auto mt-3 h-2 w-3/4 rounded-full bg-zinc-200" />
                    <div className="mx-auto mt-1.5 h-2 w-1/2 rounded-full bg-zinc-200" />
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-[11px] font-semibold text-white shadow-sm">
                      Get started <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                  {/* Fake cards */}
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm"
                      >
                        <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-orange-100 to-rose-100" />
                        <div className="mt-2 h-1.5 w-3/4 rounded-full bg-zinc-200" />
                        <div className="mt-1 h-1.5 w-1/3 rounded-full bg-zinc-200" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-zinc-400">
              The storefront builder — what you edit is exactly what goes live.
            </p>
          </div>
        </div>
      </section>

      {/* Replace-the-stack strip */}
      <section id="platform" className="border-y border-zinc-100 bg-zinc-50/60 py-12">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            One platform that replaces the creator stack
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {REPLACES.map((name) => (
              <span
                key={name}
                className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-400 line-through decoration-zinc-300"
              >
                {name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white">
              CNS Creator OS <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to{" "}
            <span className="font-display italic text-gradient">make it real</span>
          </h2>
          <p className="mt-3 text-zinc-500">
            From your first idea to a published storefront and a sold-out course — no code, no
            scattered tools, no starting over.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href="/signup"
              className="card-lift group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} text-white shadow-sm`}
              >
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 flex items-center gap-1.5 font-semibold text-zinc-900">
                {f.title}
                <ArrowRight className="h-3.5 w-3.5 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-500" />
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-zinc-100 bg-zinc-50/60 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From idea to live in{" "}
              <span className="font-display italic text-gradient">minutes</span>
            </h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-zinc-200 bg-white p-6">
                <span className="absolute right-5 top-4 font-display text-4xl italic text-zinc-100">
                  0{i + 1}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-zinc-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-transform hover:scale-[1.02]"
            >
              Start building today
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-brand text-[11px] font-bold text-white">
            C
          </span>
          <span className="text-sm font-medium text-zinc-700">CNS Creator OS</span>
        </div>
        <p className="text-xs text-zinc-400">
          Built for creators who ship. © {new Date().getFullYear()}
        </p>
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <Link href="/login" className="hover:text-zinc-900">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-zinc-900">
            Get started
          </Link>
        </div>
      </footer>
    </div>
  );
}