"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { TextField, TextAreaField } from "@/components/builder/fields";
import {
  CatalogKind,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  ProductType,
} from "@/components/catalog/types";
import { centsToDollars, dollarsToCents, formatPrice } from "@/lib/utils";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Image as ImageIcon,
  FileText,
} from "lucide-react";

const KIND_SINGULAR: Record<CatalogKind, string> = { product: "product", course: "course" };

type LoadState = "loading" | "ready" | "not-found" | "error";

export default function CatalogEditor({ kind, id }: { kind: CatalogKind; id: string }) {
  const router = useRouter();
  const table = kind === "product" ? "products" : "courses";

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [type, setType] = useState<ProductType>("pdf");
  const [isPublished, setIsPublished] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        const columns =
          kind === "product"
            ? "id, type, title, description, price_cents, cover_image_url, file_url, is_published"
            : "id, title, description, price_cents, cover_image_url, is_published";
        const { data: row, error } = await supabase
          .from(table)
          .select(columns)
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!row) {
          if (!cancelled) setLoadState("not-found");
          return;
        }
        const r = row as unknown as {
          type?: ProductType;
          title: string;
          description: string | null;
          price_cents: number;
          cover_image_url: string | null;
          file_url: string | null;
          is_published: boolean;
        };
        const snapshot = JSON.stringify({
          type: r.type,
          title: r.title,
          description: r.description ?? "",
          price_cents: r.price_cents,
          cover_image_url: r.cover_image_url ?? "",
          file_url: r.file_url ?? "",
          is_published: r.is_published,
        });
        if (!cancelled) {
          setTitle(r.title);
          setDescription(r.description ?? "");
          setPriceDollars(centsToDollars(r.price_cents));
          setCoverImageUrl(r.cover_image_url ?? "");
          setFileUrl(r.file_url ?? "");
          if (r.type) setType(r.type);
          setIsPublished(r.is_published);
          setLastSnapshot(snapshot);
          setLoadState("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(e instanceof Error ? e.message : `Failed to load ${KIND_SINGULAR[kind]}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, id, table]);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        type,
        title,
        description,
        price_cents: dollarsToCents(priceDollars),
        cover_image_url: coverImageUrl,
        file_url: fileUrl,
        is_published: isPublished,
      }),
    [type, title, description, priceDollars, coverImageUrl, fileUrl, isPublished]
  );
  const dirty = lastSnapshot !== snapshot;

  function markDirty() {
    setSaveState("idle");
  }

  async function save() {
    setSaving(true);
    setSaveState("idle");
    setSaveError(null);
    try {
      if (!title.trim()) throw new Error(`Give the ${KIND_SINGULAR[kind]} a title`);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const payload =
        kind === "product"
          ? {
              type,
              title: title.trim(),
              description: description || null,
              price_cents: dollarsToCents(priceDollars),
              cover_image_url: coverImageUrl || null,
              file_url: fileUrl || null,
              is_published: isPublished,
            }
          : {
              title: title.trim(),
              description: description || null,
              price_cents: dollarsToCents(priceDollars),
              cover_image_url: coverImageUrl || null,
              is_published: isPublished,
            };
      // The hand-rolled Database type lacks Relationships keys (see brand-kit).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any).update(payload).eq("id", id);
      if (error) throw error;
      setLastSnapshot(snapshot);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Failed to save");
      console.error(`${KIND_SINGULAR[kind]} save failed`, e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<boolean> {
    setDeleting(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any).delete().eq("id", id);
      if (error) throw error;
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
      return false;
    } finally {
      setDeleting(false);
    }
  }

  if (loadState !== "ready") {
    return (
      <div className="py-16 text-center">
        {loadState === "loading" ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : loadState === "not-found" ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-zinc-500">
              This {KIND_SINGULAR[kind]} doesn&rsquo;t exist or was deleted.
            </p>
            <Button asChild variant="outline">
              <Link href={`/dashboard/${table}`}>Back to {KIND_SINGULAR[kind]}s</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-red-600">{loadError || "Something went wrong."}</p>
        )}
      </div>
    );
  }

  const priceCents = dollarsToCents(priceDollars);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="sm" className="text-zinc-500 shrink-0">
            <Link href={`/dashboard/${table}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
              {title || "Untitled"}
            </h1>
            <Badge variant={isPublished ? "default" : "secondary"} className="shrink-0">
              {isPublished ? "Live" : "Draft"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {saveState === "saved" && !dirty ? (
            <span className="text-xs text-emerald-600">Saved</span>
          ) : null}
          {saveState === "error" ? (
            <span className="text-xs text-red-600 max-w-[240px] text-right break-words">{saveError}</span>
          ) : null}
          <Button size="sm" disabled={saving || !dirty} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-600" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${KIND_SINGULAR[kind]}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <Label className="text-zinc-800">Published</Label>
            <p className="text-xs text-zinc-400">
              Published {KIND_SINGULAR[kind]}s are shown on your storefront.
            </p>
          </div>
          <Switch
            checked={isPublished}
            onCheckedChange={(v) => {
              setIsPublished(v);
              markDirty();
            }}
          />
        </div>

        <TextField label="Title" value={title} onChange={(v) => { setTitle(v); markDirty(); }} />
        <TextAreaField
          label="Description"
          value={description}
          onChange={(v) => { setDescription(v); markDirty(); }}
          rows={4}
          placeholder="What is it, who is it for, what do they get?"
        />

        {kind === "product" ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-700">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as ProductType);
                markDirty();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PRODUCT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label className="text-zinc-700">Price (USD)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={priceDollars}
              onChange={(e) => {
                setPriceDollars(e.target.value);
                markDirty();
              }}
              placeholder="29"
              className="max-w-[160px]"
            />
            <span className="text-sm text-zinc-400">= {formatPrice(priceCents)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-zinc-700 flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-zinc-400" />
            Cover image URL
          </Label>
          <Input
            value={coverImageUrl}
            onChange={(e) => {
              setCoverImageUrl(e.target.value);
              markDirty();
            }}
            placeholder="https://…"
          />
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt=""
              className="mt-1 h-36 w-full rounded-lg border border-zinc-200 object-cover"
            />
          ) : null}
        </div>

        {kind === "product" ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-700 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-zinc-400" />
              File URL
            </Label>
            <Input
              value={fileUrl}
              onChange={(e) => {
                setFileUrl(e.target.value);
                markDirty();
              }}
              placeholder="https://… (delivery file, added in the payments phase)"
            />
            <p className="text-xs text-zinc-400">
              Stored privately per creator. Checkout/delivery wiring arrives in a later phase.
            </p>
          </div>
        ) : null}
      </div>

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{title}&rdquo;?</DialogTitle>
            <DialogDescription>
              This permanently removes the {KIND_SINGULAR[kind]} and hides it from your storefront
              if it was published. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const ok = await remove();
                if (ok) {
                  router.replace(`/dashboard/${table}`);
                } else {
                  setConfirmDelete(false);
                }
              }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {KIND_SINGULAR[kind]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
