"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, RefreshCw, Save, Palette, Type, Megaphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UploadField from "@/components/builder/UploadField";
import { cn } from "@/lib/utils";

/**
 * Brand kit — Canva-style canvas editor. Left: a live "brand board" preview
 * (logo, palette, type sample, voice chip) that updates as you edit. Right:
 * the editors. Colors are swatch pickers (no JSON), fonts are preset cards.
 */

const COLOR_SLOTS = [
  { key: "primary", label: "Primary", hint: "Buttons & links" },
  { key: "secondary", label: "Secondary", hint: "Section backgrounds" },
  { key: "accent", label: "Accent", hint: "Highlights & badges" },
] as const;

const FONT_PRESETS = [
  { label: "Modern", display: "Inter", body: "Inter", sample: "Aa" },
  { label: "Editorial", display: "Georgia", body: "Inter", sample: "Aa" },
  { label: "Bold", display: "Impact", body: "Inter", sample: "Aa" },
  { label: "Friendly", display: "Trebuchet MS", body: "Verdana", sample: "Aa" },
  { label: "Classic", display: "Times New Roman", body: "Georgia", sample: "Aa" },
] as const;

export default function BrandKitPage() {
  // Production builds freeze NEXT_PUBLIC_* at build time; if this build was
  // made without them, every client write fails. Detect once, up front.
  const envOk = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [envError, setEnvError] = useState(!envOk);
  const [brandName, setBrandName] = useState("");
  const [handle, setHandle] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [preferredCta, setPreferredCta] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [colors, setColors] = useState<Record<string, string>>({});
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const snapshotRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase.from("creators").select("*").maybeSingle();
        if (error) throw error;
        if (data && !cancelled) {
          setLoadFailed(false);
          const row = data as unknown as {
            brand_name: string;
            handle: string;
            brand_colors: Record<string, unknown> | null;
            tone_of_voice: string | null;
            target_audience: string | null;
            preferred_cta: string | null;
            logo_url: string | null;
            fonts: Record<string, unknown> | null;
          };
          setBrandName(row.brand_name ?? "");
          setHandle(row.handle ?? "");
          setToneOfVoice(row.tone_of_voice ?? "");
          setTargetAudience(row.target_audience ?? "");
          setPreferredCta(row.preferred_cta ?? "");
          setLogoUrl(row.logo_url ?? "");
          setColors((row.brand_colors ?? {}) as Record<string, string>);
          setFonts((row.fonts ?? {}) as Record<string, string>);
          snapshotRef.current = JSON.stringify({
            brandName: row.brand_name,
            handle: row.handle,
            toneOfVoice: row.tone_of_voice,
            targetAudience: row.target_audience,
            preferredCta: row.preferred_cta,
            logoUrl: row.logo_url,
            colors: row.brand_colors ?? {},
            fonts: row.fonts ?? {},
          });
          setInitial(snapshotRef.current);
        } else if (!cancelled) {
          // No creator row yet (brand-new account, or RLS hides it) — the save
          // below creates it, so the editor must start out fully writable.
          setInitial("");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadFailed(true);
          setError(e instanceof Error ? e.message : "Failed to load brand kit");
          // Still allow editing: a retry via Save is better than a dead page.
          setInitial("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => {
    const snap = JSON.stringify({ brandName, handle, toneOfVoice, targetAudience, preferredCta, logoUrl, colors, fonts });
    // initial === null means the row never loaded — treat edits as dirty so the
    // creator can always save (first save creates the row).
    return initial !== null && snap !== initial;
  }, [brandName, handle, toneOfVoice, targetAudience, preferredCta, logoUrl, colors, fonts, initial]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaveState("idle");
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error(
          "Missing Supabase config — rebuild with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set (production builds freeze these at build time)."
        );
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw new Error(`Session error: ${authError.message} — try signing in again`);
      if (!user) throw new Error("Not signed in");

      const cleanHandle = handle
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      // The hand-rolled Database type lacks Relationships keys.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("creators") as any).upsert(
        {
          user_id: user.id,
          brand_name: brandName,
          handle: cleanHandle,
          brand_colors: colors,
          tone_of_voice: toneOfVoice,
          target_audience: targetAudience,
          preferred_cta: preferredCta,
          logo_url: logoUrl || null,
          fonts: fonts || {},
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setLoadFailed(false);
      const snap = JSON.stringify({ brandName, handle: cleanHandle, toneOfVoice, targetAudience, preferredCta, logoUrl, colors, fonts });
      setInitial(snap);
      setHandle(cleanHandle);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "Failed to save brand kit");
    } finally {
      setSaving(false);
    }
  }

  function setColor(slot: string, value: string) {
    setColors((c) => ({ ...c, [slot]: value }));
  }

  const primary = colors.primary || "#18181b";
  const secondary = colors.secondary || "#f4f4f5";
  const accent = colors.accent || "#f97316";
  const displayFont = fonts.display || "Inter";
  const bodyFont = fonts.body || "Inter";

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
      </div>
    );
  }

  if (envError) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">Brand kit is unavailable: Supabase is not configured in this build.</p>
        <p className="mt-2 text-xs text-red-500">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then rebuild — production builds freeze env vars at build time.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Brand kit</h1>
          <p className="text-xs text-zinc-400">Your identity — applied across the storefront, AI copy and course player.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveState === "saved" && !dirty ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          ) : null}
          {error ? <span className="max-w-[320px] truncate text-xs text-red-600" title={error}>{error}</span> : null}
          {loadFailed ? (
            <Button onClick={save} disabled={saving} size="sm" variant="outline">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Retry save
            </Button>
          ) : null}
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        {/* ------------------------- Brand board (canvas) ------------------------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {/* Canvas head — logo + name, like a Canva brand board */}
            <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-100">
              <div
                className="absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage: `radial-gradient(circle at 20% 30%, ${accent}22 0%, transparent 45%), radial-gradient(circle at 80% 70%, ${primary}18 0%, transparent 40%)`,
                }}
              />
              <div className="relative flex flex-col items-center gap-2.5">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-xl object-contain shadow-sm ring-1 ring-zinc-200 bg-white" />
                ) : (
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm"
                    style={{ backgroundColor: primary }}
                  >
                    {(brandName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <p className="max-w-[240px] truncate text-lg font-semibold text-zinc-900" style={{ fontFamily: displayFont }}>
                  {brandName || "Your brand"}
                </p>
                {handle ? <p className="text-[11px] text-zinc-400">/c/{handle}</p> : null}
              </div>
            </div>

            {/* Palette strip */}
            <div className="flex h-14 divide-x divide-zinc-100 border-y border-zinc-100">
              {[["Primary", primary], ["Secondary", secondary], ["Accent", accent]].map(([label, c]) => (
                <div key={label} className="flex flex-1 flex-col items-center justify-center gap-0.5">
                  <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: c }} />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-400">{label}</span>
                </div>
              ))}
            </div>

            {/* Type sample */}
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Type</p>
              <p className="mt-1.5 text-2xl leading-tight text-zinc-900" style={{ fontFamily: displayFont }}>
                Create & launch
              </p>
              <p className="mt-1 text-sm text-zinc-500" style={{ fontFamily: bodyFont }}>
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>

            {/* Voice chip */}
            <div className="border-t border-zinc-100 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Voice</p>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                {toneOfVoice || targetAudience || "Describe your tone & audience →"}
              </p>
              {preferredCta ? (
                <span
                  className="mt-2.5 inline-block rounded-md px-3 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: primary }}
                >
                  {preferredCta}
                </span>
              ) : null}
            </div>

            {handle ? (
              <Link
                href={`/c/${handle}`}
                target="_blank"
                className="flex items-center justify-center gap-1.5 border-t border-zinc-100 py-2.5 text-xs text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
              >
                View public page <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* ------------------------------ Editors ------------------------------ */}
        <div className="flex flex-col gap-5">
          {/* Identity */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 pb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <Megaphone className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-zinc-900">Identity</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Brand name">
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme Coaching" />
              </Labeled>
              <Labeled label="Handle" hint="your public URL">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">/c/</span>
                  <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="acme-coaching" />
                </div>
              </Labeled>
            </div>
            <div className="mt-4">
              <Labeled label="Logo" hint="square works best">
                <UploadField
                  label="Logo"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  kind="image"
                  bucket="avatars"
                  pathPrefix="brand"
                />
              </Labeled>
            </div>
          </section>

          {/* Colors — Canva-style swatches */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 pb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                <Palette className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-zinc-900">Colors</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {COLOR_SLOTS.map((slot) => (
                <div key={slot.key} className="rounded-xl border border-zinc-200 p-3">
                  <div className="flex items-center gap-3">
                    <label className="relative cursor-pointer" title={`Pick ${slot.label.toLowerCase()}`}>
                      <span
                        className="block h-10 w-10 rounded-lg shadow-inner ring-1 ring-black/10"
                        style={{ backgroundColor: colors[slot.key] || DEFAULTS[slot.key] }}
                      />
                      <input
                        type="color"
                        value={colors[slot.key] || DEFAULTS[slot.key]}
                        onChange={(e) => setColor(slot.key, e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={`${slot.label} color`}
                      />
                    </label>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-800">{slot.label}</p>
                      <input
                        value={colors[slot.key] || ""}
                        onChange={(e) => setColor(slot.key, e.target.value)}
                        placeholder="#RRGGBB"
                        className="w-full bg-transparent font-mono text-[11px] text-zinc-400 outline-none placeholder:text-zinc-300"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-400">{slot.hint}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Fonts */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 pb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-white">
                <Type className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-zinc-900">Fonts</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {FONT_PRESETS.map((preset) => {
                const active =
                  (fonts.display || "Inter") === preset.display && (fonts.body || "Inter") === preset.body;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setFonts({ display: preset.display, body: preset.body })}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 transition-all",
                      active
                        ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                    )}
                  >
                    <span className="text-2xl leading-none text-zinc-900" style={{ fontFamily: preset.display }}>
                      {preset.sample}
                    </span>
                    <span className="text-[11px] font-medium text-zinc-600">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Voice */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 pb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                <RefreshCw className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-zinc-900">Voice & audience</h2>
            </div>
            <div className="grid gap-4">
              <Labeled label="Tone of voice" hint="the AI writes in this voice">
                <Input value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} placeholder="Warm, direct, no-hype" />
              </Labeled>
              <Labeled label="Target audience">
                <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Aspiring creators quitting their 9–5" />
              </Labeled>
              <Labeled label="Preferred CTA">
                <Input value={preferredCta} onChange={(e) => setPreferredCta(e.target.value)} placeholder="Start today" />
              </Labeled>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const DEFAULTS: Record<string, string> = {
  primary: "#18181b",
  secondary: "#f4f4f5",
  accent: "#f97316",
};

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-zinc-700">{label}</span>
        {hint ? <span className="text-[10px] text-zinc-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
