"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LandingPageType,
  LANDING_PAGE_TYPES,
  LANDING_PAGE_TYPE_LABELS,
  SLUG_PATTERN,
  defaultLandingBlocks,
  slugify,
} from "@/types/blocks";
import { Plus, FileText, Loader2, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageRow {
  id: string;
  title: string;
  slug: string;
  type: LandingPageType;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

type LoadState = "loading" | "ready" | "no-creator" | "error";

export default function LandingPagesPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [pages, setPages] = useState<PageRow[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [type, setType] = useState<LandingPageType>("sales");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation
  const [rowToDelete, setRowToDelete] = useState<PageRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

        const { data: rows, error } = await supabase
          .from("landing_pages")
          .select("id, title, slug, type, is_published, created_at, updated_at")
          .order("updated_at", { ascending: false });
        if (error) throw error;

        if (!cancelled) {
          setCreatorId((creator as { id: string }).id);
          setHandle((creator as { handle: string }).handle);
          setPages((rows ?? []) as unknown as PageRow[]);
          setLoadState("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(e instanceof Error ? e.message : "Failed to load landing pages");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setType("sales");
    setCreateError(null);
    setCreateOpen(true);
  }

  const derivedSlug = slugTouched ? slug : slugify(title);
  const slugTaken = derivedSlug
    ? pages.some((p) => p.slug === derivedSlug)
    : false;

  async function createPage() {
    if (!creatorId) return;
    setCreating(true);
    setCreateError(null);
    try {
      if (!title.trim()) throw new Error("Give the page a title");
      if (!SLUG_PATTERN.test(derivedSlug)) {
        throw new Error("Slug can only contain lowercase letters, numbers and dashes");
      }
      if (slugTaken) throw new Error("That slug is already in use — pick another one");
      const content = defaultLandingBlocks(type, title.trim());
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // The hand-rolled Database type lacks Relationships keys, so the
      // generic write builder resolves to never; cast to a minimal shape.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("landing_pages") as any)
        .insert({
          creator_id: creatorId,
          title: title.trim(),
          slug: derivedSlug,
          type,
          content: content as unknown as Record<string, unknown>,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("That slug is already in use — pick another one");
        throw error;
      }
      setCreateOpen(false);
      router.push(`/dashboard/landing-pages/${(data as { id: string }).id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create page");
    } finally {
      setCreating(false);
    }
  }

  async function deletePage() {
    if (!rowToDelete) return;
    setDeleting(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.from("landing_pages").delete().eq("id", rowToDelete.id);
      if (error) throw error;
      setPages((prev) => prev.filter((p) => p.id !== rowToDelete.id));
      setRowToDelete(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete page");
      setRowToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Landing pages</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Sales pages, waitlists, lead magnets and more.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New page
        </Button>
      </div>

      {loadState === "loading" ? (
        <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p>
      ) : null}
      {loadState === "error" ? (
        <p className="text-sm text-red-600 py-10 text-center">{loadError}</p>
      ) : null}
      {loadState === "no-creator" ? (
        <div className="py-10 text-center flex flex-col items-center gap-4">
          <p className="text-sm text-zinc-500 max-w-sm">
            Set up your brand kit (name + handle) first — landing pages are tied to your creator
            profile.
          </p>
          <Button asChild>
            <Link href="/dashboard/brand-kit">Open Brand Kit</Link>
          </Button>
        </div>
      ) : null}

      {loadState === "ready" ? (
        pages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-16 flex flex-col items-center gap-3 text-center px-6">
            <FileText className="h-8 w-8 text-zinc-300" />
            <div>
              <p className="text-sm font-medium text-zinc-700">No pages yet</p>
              <p className="text-xs text-zinc-400 mt-1">
                Create a sales page, waitlist, or thank-you page — each is published at
                /lp/{handle}/your-slug.
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pages.map((page) => (
              <li
                key={page.id}
                className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/landing-pages/${page.id}`}
                      className="truncate text-sm font-medium text-zinc-900 hover:underline"
                    >
                      {page.title}
                    </Link>
                    <Badge variant={page.is_published ? "default" : "secondary"} className="shrink-0">
                      {page.is_published ? "Live" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    /lp/{handle}/{page.slug} · {LANDING_PAGE_TYPE_LABELS[page.type]} · updated{" "}
                    {new Date(page.updated_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                {page.is_published ? (
                  <Button asChild variant="ghost" size="icon" className="text-zinc-400">
                    <Link href={`/lp/${handle}/${page.slug}`} target="_blank" aria-label="View live page">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/landing-pages/${page.id}`}>Edit</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-red-600"
                  onClick={() => setRowToDelete(page)}
                  aria-label={`Delete ${page.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New landing page</DialogTitle>
            <DialogDescription>
              You&rsquo;ll be able to add and edit content blocks right after.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-700">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Free template waitlist"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-700">Slug</Label>
              <Input
                value={derivedSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="free-template-waitlist"
                className={cn(slugTaken && "border-red-400")}
              />
              <p className="text-xs text-zinc-400">
                {slugTaken ? (
                  <span className="text-red-600">This slug is already in use on your account.</span>
                ) : (
                  <>
                    Your page lives at <span className="font-mono">/lp/{handle}/{derivedSlug || "…"}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-700">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as LandingPageType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANDING_PAGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LANDING_PAGE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createPage} disabled={creating || slugTaken || !title.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!rowToDelete} onOpenChange={(open) => !open && setRowToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{rowToDelete?.title}&rdquo;?</DialogTitle>
            <DialogDescription>
              This permanently removes the page and its URL. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRowToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deletePage} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
