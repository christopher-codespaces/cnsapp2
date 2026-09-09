"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Block,
  LandingContent,
  LandingPageType,
  LANDING_PAGE_TYPE_LABELS,
  SLUG_PATTERN,
  normalizeLandingContent,
} from "@/types/blocks";
import CraftPageEditor from "@/components/landing/craft/CraftPageEditor";
import { TextField } from "@/components/builder/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Layers,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "ready" | "not-found" | "no-creator" | "error";

export default function LandingPageEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [handle, setHandle] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<LandingPageType>("sales");
  const [content, setContent] = useState<LandingContent>({ blocks: [] });
  const [seedBlocks, setSeedBlocks] = useState<Block[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [otherSlugs, setOtherSlugs] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");

        const { data: creator } = await supabase
          .from("creators")
          .select("id, handle")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!creator) {
          if (!cancelled) setLoadState("no-creator");
          return;
        }
        const c = creator as { id: string; handle: string };

        const { data: page, error } = await supabase
          .from("landing_pages")
          .select("id, title, slug, type, content, is_published")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!page) {
          if (!cancelled) setLoadState("not-found");
          return;
        }

        // Existing slugs (for friendly duplicate detection on save).
        const { data: slugs } = await supabase.from("landing_pages").select("slug").neq("id", id);
        const existing = ((slugs ?? []) as { slug: string }[]).map((r) => r.slug);

        const row = page as unknown as {
          title: string;
          slug: string;
          type: LandingPageType;
          content: unknown;
          is_published: boolean;
        };
        const parsed = normalizeLandingContent(row.content);

        if (!cancelled) {
          setHandle(c.handle);
          setTitle(row.title);
          setSlug(row.slug);
          setType(row.type);
          setContent(parsed);
          setSeedBlocks(parsed.blocks);
          setIsPublished(row.is_published);
          setOtherSlugs(existing);
          setLastSnapshot(
            JSON.stringify({ title: row.title, slug: row.slug, content: parsed, is_published: row.is_published })
          );
          setLoadState("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(e instanceof Error ? e.message : "Failed to load page");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dirty = useMemo(
    () => lastSnapshot !== JSON.stringify({ title, slug, content, is_published: isPublished }),
    [lastSnapshot, title, slug, content, isPublished]
  );

  const slugProblem = useMemo(() => {
    if (!slug) return "Slug is required";
    if (!SLUG_PATTERN.test(slug)) return "Only lowercase letters, numbers and dashes";
    if (otherSlugs.includes(slug)) return "This slug is already used by another page";
    return null;
  }, [slug, otherSlugs]);

  async function save() {
    setSaving(true);
    setSaveState("idle");
    setSaveError(null);
    try {
      if (!title.trim()) throw new Error("Give the page a title");
      if (slugProblem) throw new Error(slugProblem);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // The hand-rolled Database type lacks Relationships keys (see brand-kit).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("landing_pages") as any)
        .update({
          title: title.trim(),
          slug,
          content: content as unknown as Record<string, unknown>,
          is_published: isPublished,
        })
        .eq("id", id);
      if (error) {
        if (error.code === "23505") throw new Error("That slug is already in use — pick another one");
        throw error;
      }
      setLastSnapshot(JSON.stringify({ title, slug, content, is_published: isPublished }));
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Failed to save page");
      console.error("landing page save failed", e);
    } finally {
      setSaving(false);
    }
  }

  if (loadState !== "ready") {
    return (
      <div className="py-16 text-center">
        {loadState === "loading" ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : loadState === "not-found" ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-zinc-500">This page doesn&rsquo;t exist or was deleted.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/landing-pages">Back to landing pages</Link>
            </Button>
          </div>
        ) : loadState === "no-creator" ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-zinc-500">Set up your Brand Kit first.</p>
            <Button asChild>
              <Link href="/dashboard/brand-kit">Open Brand Kit</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-red-600">{loadError || "Something went wrong."}</p>
        )}
      </div>
    );
  }

  const liveUrl = isPublished ? `/lp/${handle}/${slug}` : null;

  return (
    <div className="flex flex-col h-[calc(100vh-128px)] min-h-[560px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="sm" className="text-zinc-500 shrink-0">
            <Link href="/dashboard/landing-pages">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">{title || "Untitled"}</h1>
              <Badge variant={isPublished ? "default" : "secondary"} className="shrink-0">
                {isPublished ? "Live" : "Draft"}
              </Badge>
              <Badge variant="outline" className="shrink-0 text-zinc-500">
                {LANDING_PAGE_TYPE_LABELS[type]}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saveState === "saved" && !dirty ? <span className="text-xs text-emerald-600">Saved</span> : null}
          {saveState === "error" ? (
            <span className="text-xs text-red-600 max-w-[220px] text-right break-words">{saveError}</span>
          ) : null}
          {liveUrl ? (
            <Button asChild variant="ghost" size="sm" className="text-zinc-600">
              <Link href={liveUrl} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                View live
              </Link>
            </Button>
          ) : null}
          <Button size="sm" disabled={saving || !dirty} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <div className="flex items-center gap-2 pl-1">
            <Switch
              id="publish-lp"
              checked={isPublished}
              onCheckedChange={(v) => {
                setIsPublished(v);
                setSaveState("idle");
              }}
            />
            <label htmlFor="publish-lp" className="text-sm text-zinc-600 cursor-pointer select-none">
              Published
            </label>
          </div>
        </div>
      </div>

      {/* Body: settings rail + craft editor */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Page settings */}
        <aside className="w-full lg:w-[300px] shrink-0 rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-3 overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Page settings
          </p>
          <TextField
            label="Title"
            value={title}
            onChange={(v) => {
              setTitle(v);
              setSaveState("idle");
            }}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-700">Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 font-mono shrink-0">/lp/{handle}/</span>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSaveState("idle");
                }}
                className={cn(slugProblem && "border-red-400")}
              />
            </div>
            {slugProblem ? (
              <p className="text-xs text-red-600">{slugProblem}</p>
            ) : (
              <p className="text-xs text-zinc-400">
                Lowercase letters, numbers and dashes. Must be unique per account.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
            <span className="text-sm text-zinc-700">Published</span>
            <Switch
              checked={isPublished}
              onCheckedChange={(v) => {
                setIsPublished(v);
                setSaveState("idle");
              }}
            />
          </div>
          <div className="mt-auto rounded-lg border border-dashed border-zinc-200 p-3 flex gap-2.5 text-xs text-zinc-400 leading-relaxed">
            <MousePointerClick className="h-4 w-4 shrink-0 text-zinc-300" />
            <span>
              Click any block in the canvas to edit it. Drag the ≡ handle to reorder. Blocks live
              in the panel on the canvas&rsquo;s left.
            </span>
          </div>
        </aside>

        {/* Craft.js editor — keyed by page id so state resets per page */}
        <CraftPageEditor
          key={id}
          seedBlocks={seedBlocks}
          blocks={content.blocks}
          onChangeBlocks={(next) => {
            setContent({ blocks: next });
            setSaveState("idle");
          }}
        />
      </div>
    </div>
  );
}
