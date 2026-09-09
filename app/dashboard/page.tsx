import Link from "next/link";
import {
  Store,
  FileText,
  Palette,
  ShoppingBag,
  BookOpen,
  ArrowRight,
  Sparkles,
  ReceiptText,
  BarChart3,
} from "lucide-react";
import Stats from "@/components/dashboard/Stats";

const TOOLS = [
  {
    href: "/dashboard/ai",
    title: "AI workspace",
    description: "Ask your AI copilot anything about your brand, storefront and catalog.",
    icon: Sparkles,
    gradient: "bg-gradient-to-br from-amber-400 to-orange-500",
  },
  {
    href: "/dashboard/storefront",
    title: "Storefront",
    description: "Your published homepage — hero, video VSL, products, FAQ and email capture.",
    icon: Store,
    gradient: "bg-gradient-to-br from-orange-400 to-rose-500",
  },
  {
    href: "/dashboard/products",
    title: "Products",
    description: "Ebooks, templates and memberships — published items show up on your storefront.",
    icon: ShoppingBag,
    gradient: "bg-gradient-to-br from-rose-400 to-pink-600",
  },
  {
    href: "/dashboard/courses",
    title: "Courses",
    description: "Outline modules and lessons, upload videos, and teach like a pro.",
    icon: BookOpen,
    gradient: "bg-gradient-to-br from-sky-400 to-indigo-600",
  },
  {
    href: "/dashboard/orders",
    title: "Orders",
    description: "Every sale across your products and courses, with revenue totals.",
    icon: ReceiptText,
    gradient: "bg-gradient-to-br from-teal-400 to-cyan-600",
  },
  {
    href: "/dashboard/analytics",
    title: "Analytics",
    description: "Views, signups, enrollments and revenue from the last 30 days.",
    icon: BarChart3,
    gradient: "bg-gradient-to-br from-lime-400 to-emerald-600",
  },
  {
    href: "/dashboard/landing-pages",
    title: "Landing pages",
    description: "Sales pages, waitlists, lead magnets and thank-you pages in a drag-and-drop editor.",
    icon: FileText,
    gradient: "bg-gradient-to-br from-violet-400 to-purple-600",
  },
  {
    href: "/dashboard/brand-kit",
    title: "Brand kit",
    description: "Your name, handle, colors, voice and audience — reused across every page.",
    icon: Palette,
    gradient: "bg-gradient-to-br from-emerald-400 to-teal-600",
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero banner */}
      <div className="hero-glow relative overflow-hidden rounded-2xl border border-zinc-200 bg-white px-6 py-8 sm:px-8">
        <div className="bg-grid-faint pointer-events-none absolute inset-0" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 shadow-sm">
              <Sparkles className="h-3 w-3 text-orange-500" />
              Your creator command center
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Build, launch, sell &amp; teach —{" "}
              <span className="font-display italic text-gradient">from one place.</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Start anywhere: polish your storefront, outline a course, or ask the AI for a
              second opinion on your copy.
            </p>
          </div>
          <Link
            href="/dashboard/ai"
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-zinc-700"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            Ask the AI
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Stats */}
      <Stats />

      {/* Tools */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="card-lift group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${tool.gradient} text-white shadow-sm`}
            >
              <tool.icon className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="flex items-center gap-1.5 font-semibold text-zinc-900">
                {tool.title}
                <ArrowRight className="h-4 w-4 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-500" />
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">{tool.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}