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
  CatalogKind,
  CatalogListRow,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  ProductType,
} from "@/components/catalog/types";
import { formatPrice } from "@/lib/utils";
import { Plus, Loader2, Trash2, Package, BookOpen } from "lucide-react";

const KIND_LABEL: Record<CatalogKind, string> = { product: "Products", course: "Courses" };
const KIND_SINGULAR: Record<CatalogKind, string> = { product: "product", course: "course" };

type LoadState = "loading" | "ready" | "no-creator" | "error";

export default function CatalogList({ kind }: { kind: CatalogKind }) {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [rows, setRows] = useState<CatalogListRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ProductType>("pdf");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [rowToDelete, setRowToDelete] = useState<CatalogListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const table = kind === "product" ? "products" : "courses";

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
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!creator) {
          if (!cancelled) setLoadState("no-creator");
          return;
        }
        const columns =
          kind === "product"
            ? "id, title, type, price_cents, is_published, updated_at"
            : "id, title, price_cents, is_published, updated_at";
        const { data, error } = await supabase
          .from(table)
          .select(columns)
          .eq("creator_id", (creator as { id: string }).id)
          .order("updated_at", { ascending: false });
        if (error) throw error;

        if (!cancelled) {
          setCreatorId((creator as { id: string }).id);
          setRows((data ?? []) as unknown as CatalogListRow[]);
          setLoadState("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(e instanceof Error ? e.message : `Failed to load ${KIND_SINGULAR[kind]}s`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, table]);

  function openCreate() {
    setTitle("");
    setType("pdf");
    setCreateError(null);
    setCreateOpen(true);
  }

  async function createRow() {
    if (!creatorId) return;
    setCreating(true);
    setCreateError(null);
    try {
      if (!title.trim()) throw new Error(`Give the ${KIND_SINGULAR[kind]} a title`);
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const payload =
        kind === "product"
          ? { creator_id: creatorId, title: title.trim(), type }
          : { creator_id: creatorId, title: title.trim() };
      // The hand-rolled Database type lacks Relationships keys (see brand-kit).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      setCreateOpen(false);
      router.push(`/dashboard/${table}/${(data as { id: string }).id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function deleteRow() {
    if (!rowToDelete) return;
    setDeleting(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any).delete().eq("id", rowToDelete.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== rowToDelete.id));
      setRowToDelete(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
      setRowToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const EmptyIcon = kind === "product" ? Package : BookOpen;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{KIND_LABEL[kind]}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {kind === "product"
              ? "Digital products you sell — published ones appear on your storefront."
              : "Online courses — published ones appear on your storefront."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New {KIND_SINGULAR[kind]}
        </Button>
      </div>

      {loadState === "loading" ? <p className="text-sm text-zinc-500 py-10 text-center">Loading…</p> : null}
      {loadState === "error" ? <p className="text-sm text-red-600 py-10 text-center">{loadError}</p> : null}
      {loadState === "no-creator" ? (
        <div className="py-10 text-center flex flex-col items-center gap-4">
          <p className="text-sm text-zinc-500 max-w-sm">
            Set up your Brand Kit (name + handle) first — {KIND_LABEL[kind].toLowerCase()} are tied to
            your creator profile.
          </p>
          <Button asChild>
            <Link href="/dashboard/brand-kit">Open Brand Kit</Link>
          </Button>
        </div>
      ) : null}

      {loadState === "ready" ? (
        rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 py-16 flex flex-col items-center gap-3 text-center px-6">
            <EmptyIcon className="h-8 w-8 text-zinc-300" />
            <div>
              <p className="text-sm font-medium text-zinc-700">No {KIND_SINGULAR[kind]}s yet</p>
              <p className="text-xs text-zinc-400 mt-1">
                Create your first {KIND_SINGULAR[kind]} and publish it to show it on your storefront.
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/${table}/${row.id}`}
                      className="truncate text-sm font-medium text-zinc-900 hover:underline"
                    >
                      {row.title}
                    </Link>
                    {row.type ? (
                      <Badge variant="outline" className="shrink-0 text-zinc-500">
                        {PRODUCT_TYPE_LABELS[row.type]}
                      </Badge>
                    ) : null}
                    <Badge variant={row.is_published ? "default" : "secondary"} className="shrink-0">
                      {row.is_published ? "Live" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatPrice(row.price_cents)} · updated{" "}
                    {new Date(row.updated_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/${table}/${row.id}`}>Edit</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-red-600"
                  onClick={() => setRowToDelete(row)}
                  aria-label={`Delete ${row.title}`}
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
            <DialogTitle>New {KIND_SINGULAR[kind]}</DialogTitle>
            <DialogDescription>
              Add the details (price, cover, description) right after.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-700">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "product" ? "e.g. The 90-Day Content Planner" : "e.g. Launch Your Storefront"}
                autoFocus
              />
            </div>
            {kind === "product" ? (
              <div className="flex flex-col gap-1.5">
                <Label className="text-zinc-700">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as ProductType)}>
                  <SelectTrigger>
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
            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createRow} disabled={creating || !title.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create {KIND_SINGULAR[kind]}
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
              This permanently removes the {KIND_SINGULAR[kind]} and it will disappear from your
              storefront if published. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRowToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteRow} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {KIND_SINGULAR[kind]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
