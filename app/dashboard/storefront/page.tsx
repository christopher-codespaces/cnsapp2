"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CatalogItem,
  StorefrontSections,
  StorefrontSectionKey,
  STOREFRONT_SECTION_ORDER,
  STOREFRONT_SECTION_LABELS,
  normalizeStorefrontSections,
} from "@/types/blocks";
import StorefrontRenderer from "@/components/storefront/StorefrontRenderer";
import { SectionEditorPanel } from "@/components/storefront/SectionEditorPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Info,
  Package,
  GraduationCap,
  Quote,
  HelpCircle,
  Mail,
  Share2,
  Phone,
  LayoutGrid,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  MonitorPlay,
  MonitorSmartphone,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<StorefrontSectionKey, React.ElementType> = {
  hero: Sparkles,
  vsl: MonitorPlay,
  about: Info,
  products: Package,
  courses: GraduationCap,
  testimonials: Quote,
  faq: HelpCircle,
  email_signup: Mail,
  social_links: Share2,
  contact: Phone,
  footer: LayoutGrid,
};

interface CreatorRow {
  id: string;
  handle: string;
  brand_name: string;
  brand_colors: Record<string, unknown>;
  logo_url: string | null;
}

type LoadState = "loading" | "ready" | "no-creator" | "error";

export default function StorefrontBuilderPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creator, setCreator] = useState<CreatorRow | null>(null);
  const [storefrontId, setStorefrontId] = useState<string | null>(null);
  const [sections, setSections] = useState<StorefrontSections | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [courses, setCourses] = useState<CatalogItem[]>([]);
  const [activeKey, setActiveKey] = useState<StorefrontSectionKey>("hero");

  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");

        const { data: creatorRow, error: creatorError } = await supabase
          .from("creators")
          .select("id, handle, brand_name, brand_colors, logo_url")
          .eq("user_id", user.id)
          .maybeSingle();
        if (creatorError) throw creatorError;

        if (!creatorRow) {
          if (!cancelled) setLoadState("no-creator");
          return;
        }

        const c = creatorRow as unknown as CreatorRow;
        const { data: storefrontRow } = await supabase
          .from("storefronts")
          .select("id, sections, is_published")
          .eq("creator_id", c.id)
          .maybeSingle();

        const stored = storefrontRow as { id: string; sections: unknown; is_published: boolean } | null;
        const nextSections = normalizeStorefrontSections(stored?.sections, c.brand_name);
        const nextPublished = stored?.is_published ?? false;

        // Published catalog items feed the Products/Courses preview cards.
        const [prodRes, courseRes] = await Promise.all([
          supabase
            .from("products")
            .select("id, title, description, price_cents, cover_image_url")
            .eq("creator_id", c.id)
            .eq("is_published", true),
          supabase
            .from("courses")
            .select("id, title, description, price_cents, cover_image_url")
            .eq("creator_id", c.id)
            .eq("is_published", true),
        ]);
        const prodRows = (prodRes.data ?? []) as unknown as CatalogItem[];
        const courseRows = (courseRes.data ?? []) as unknown as CatalogItem[];

        if (!cancelled) {
          setCreator(c);
          setStorefrontId(stored?.id ?? null);
          setSections(nextSections);
          setIsPublished(nextPublished);
          setProducts(prodRows);
          setCourses(courseRows);
          setLastSavedSnapshot(JSON.stringify({ sections: nextSections, is_published: nextPublished }));
          setLoadState("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(e instanceof Error ? e.message : "Failed to load storefront");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!sections) return false;
    return lastSavedSnapshot !== JSON.stringify({ sections, is_published: isPublished });
  }, [sections, isPublished, lastSavedSnapshot]);

  function updateSection(key: StorefrontSectionKey, next: unknown) {
    if (!sections) return;
    setSections({ ...sections, [key]: next as StorefrontSections[typeof key] });
    setSaveState("idle");
  }

  async function save() {
    if (!creator || !sections) return;
    setSaving(true);
    setSaveState("idle");
    setSaveError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const payload = {
        creator_id: creator.id,
        sections: sections as unknown as Record<string, unknown>,
        is_published: isPublished,
      };
      // The hand-rolled Database type lacks Relationships keys, so the
      // generic write builder resolves to never (see brand-kit). Avoid
      // upsert(..., { onConflict }) here: the base schema has no unique
      // constraint on storefronts.creator_id, which makes ON CONFLICT fail
      // with "no unique or exclusion constraint matching the ON CONFLICT
      // specification". Insert-or-update by primary key instead.
      if (storefrontId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("storefronts") as any)
          .update(payload)
          .eq("id", storefrontId);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from("storefronts") as any)
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setStorefrontId((data as { id: string }).id);
      }
      setLastSavedSnapshot(JSON.stringify({ sections, is_published: isPublished }));
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      const err = e as { message?: string; code?: string };
      setSaveError(err?.message || "Failed to save storefront");
      console.error("storefront save failed", e);
    } finally {
      setSaving(false);
    }
  }

  if (loadState === "loading") {
    return <CenterNote>Loading your storefront…</CenterNote>;
  }

  if (loadState === "error") {
    return <CenterNote tone="error">{loadError || "Something went wrong."}</CenterNote>;
  }

  if (loadState === "no-creator" || !creator || !sections) {
    return (
      <CenterNote>
        <div className="flex flex-col items-center gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-zinc-900">Set up your brand first</p>
            <p className="mt-1 text-sm text-zinc-500 max-w-sm">
              Your storefront needs a creator profile (brand name, handle, colors). Fill that in
              once in the Brand Kit, then come back here to build.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/brand-kit">Open Brand Kit</Link>
          </Button>
        </div>
      </CenterNote>
    );
  }

  const liveUrl = creator.handle ? `/c/${creator.handle}` : null;

  return (
    <>
      {/* The builder canvas (rail + editor + live preview) needs desktop-class
          width: phones get the friendly gate below, tablets (744px+, including
          iPad Mini portrait) and up get the full view + edit experience. */}
      <div className="hidden min-[744px]:flex flex-col h-[calc(100vh-128px)] min-h-[560px]">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Storefront</h1>
          <Badge variant={isPublished ? "default" : "secondary"} className="shrink-0">
            {isPublished ? "Live" : "Draft"}
          </Badge>
          {dirty ? <span className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" /> : null}
        </div>
        <div className="flex items-center gap-3">
          {saveState === "saved" && !dirty ? (
            <span className="text-xs text-emerald-600">Saved</span>
          ) : null}
          {saveState === "error" ? (
            <span className="text-xs text-red-600 max-w-[300px] text-right break-words">{saveError}</span>
          ) : null}
          {liveUrl && isPublished ? (
            <Button asChild variant="ghost" size="sm" className="text-zinc-600">
              <Link href={liveUrl} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                View live
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={saving || (!dirty && storefrontId !== null)} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <div className="flex items-center gap-2 pl-1">
            <Switch
              id="publish-storefront"
              checked={isPublished}
              onCheckedChange={(v) => {
                setIsPublished(v);
                setSaveState("idle");
              }}
            />
            <label htmlFor="publish-storefront" className="text-sm text-zinc-600 cursor-pointer select-none">
              Published
            </label>
          </div>
        </div>
      </div>

      {/* Body — three panes side-by-side from tablet (744px) up */}
      <div className="flex-1 min-h-0 flex flex-col min-[744px]:flex-row overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {/* Sections rail — icon-only on tablet, labelled from xl up */}
        <nav className="w-full min-[744px]:w-14 xl:w-56 shrink-0 border-b min-[744px]:border-b-0 min-[744px]:border-r border-zinc-200 bg-zinc-50/60 overflow-y-auto py-2">
          <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hidden xl:block">
            Sections
          </p>
          {STOREFRONT_SECTION_ORDER.map((key) => {
            const Icon = SECTION_ICONS[key];
            const section = sections[key];
            const active = activeKey === key;
            return (
              <div key={key} className="flex items-center px-1.5 min-[744px]:justify-center xl:justify-start">
                <button
                  type="button"
                  title={STOREFRONT_SECTION_LABELS[key]}
                  onClick={() => setActiveKey(key)}
                  className={cn(
                    "flex flex-1 min-[744px]:flex-none xl:flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm min-w-0",
                    active ? "bg-zinc-200/80 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-zinc-100"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="truncate hidden xl:inline">{STOREFRONT_SECTION_LABELS[key]}</span>
                  {!section.enabled ? (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-400 shrink-0 hidden xl:inline">Off</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-label={section.enabled ? `Hide ${STOREFRONT_SECTION_LABELS[key]}` : `Show ${STOREFRONT_SECTION_LABELS[key]}`}
                  onClick={() => updateSection(key, { ...section, enabled: !section.enabled })}
                  className="p-1.5 rounded-md text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 shrink-0 hidden min-[744px]:hidden xl:block"
                >
                  {section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Editor — 340px on tablet, 400px from xl up */}
        <div className="w-full min-[744px]:w-[340px] xl:w-[400px] shrink-0 overflow-y-auto border-b min-[744px]:border-b-0 min-[744px]:border-r border-zinc-200 p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">{STOREFRONT_SECTION_LABELS[activeKey]}</h2>
              <p className="text-xs text-zinc-400">Edits update the preview instantly.</p>
            </div>
          </div>
          <SectionEditorPanel
            key={activeKey}
            kind={activeKey}
            section={sections[activeKey]}
            onChange={(next) => updateSection(activeKey, next)}
          />
        </div>

        {/* Live preview */}
        <div className="flex-1 min-w-0 bg-zinc-100/80 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-100/90 backdrop-blur px-4 py-2 border-b border-zinc-200/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Preview</p>
            <p className="text-[11px] text-zinc-400">
              {liveUrl ? (
                <a href={liveUrl} target="_blank" rel="noreferrer" className="hover:text-zinc-600 underline">
                  {liveUrl}
                </a>
              ) : (
                "Set a handle in Brand Kit to go live"
              )}
            </p>
          </div>
          <div className="m-3 xl:m-6 mx-auto max-w-4xl overflow-hidden rounded-lg border border-zinc-200 shadow-sm">
            <StorefrontRenderer
              sections={sections}
              brandName={creator.brand_name}
              logoUrl={creator.logo_url}
              colors={creator.brand_colors}
              creatorId={null}
              products={products}
              courses={courses}
            />
          </div>
        </div>
      </div>
      </div>

      <MobileGateNotice />
    </>
  );
}

/** Phones: the three-pane builder can't fit — point creators to a bigger screen. */
function MobileGateNotice() {
  return (
    <div className="hidden max-[743px]:flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <p className="mt-4 text-base font-semibold text-zinc-900">This editor can’t open on a phone</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          The storefront builder needs more width than a phone screen can offer.
          Open it on a tablet or desktop and you can view and edit everything,
          including the live preview.
        </p>
      </div>
    </div>
  );
}

function CenterNote({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <p className={cn("text-sm", tone === "error" ? "text-red-600" : "text-zinc-500")}>{children}</p>
    </div>
  );
}
