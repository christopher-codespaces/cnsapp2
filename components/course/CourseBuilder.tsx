"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TextAreaField } from "@/components/builder/fields";
import UploadField from "@/components/builder/UploadField";
import VideoEmbed from "@/components/builder/VideoEmbed";
import { parseLessonVideo, signedObjectUrl } from "@/lib/storage";
import { centsToDollars, dollarsToCents, formatPrice, cn } from "@/lib/utils";
import { makeQuizQuestion, normalizeLessonMaterial } from "@/types/course";
import type { LessonMaterial, QuizQuestion } from "@/types/course";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  FileType2,
  ListChecks,
  BookOpen,
  Play,
  Check,
  CheckCircle2,
  Circle,
  AlertCircle,
  FolderOpen,
  GripVertical,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Local row shapes                                                    */
/* ------------------------------------------------------------------ */

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  position: number;
  video_url: string | null;
  content: Record<string, unknown>;
}

interface ModuleNode extends ModuleRow {
  lessons: LessonRow[];
}

type LoadState = "loading" | "ready" | "not-found" | "error";

function lessonDescription(lesson: LessonRow): string {
  const d = lesson.content?.description;
  return typeof d === "string" ? d : "";
}

/** Drag bookkeeping for handle-only reordering. */
type DragState =
  | { kind: "module"; from: number }
  | { kind: "lesson"; moduleId: string; from: number };

type DropTarget =
  | { kind: "module"; to: number }
  | { kind: "lesson"; moduleId: string; to: number };

/* ------------------------------------------------------------------ */

export default function CourseBuilder({ id }: { id: string }) {
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Course (settings tab) state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Outline state
  const [modules, setModules] = useState<ModuleNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [opBusy, setOpBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [opOk, setOpOk] = useState(false);
  const [tab, setTab] = useState<"outline" | "settings">("outline");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragHandleRef = useRef(false);

  const moduleRenameTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lessonSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const opOkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending-save tracking so the header shows "Unsaved" and can flush on demand.
  const modulesRef = useRef<ModuleNode[]>([]);
  const pendingLessonsRef = useRef<Set<string>>(new Set());
  const pendingModulesRef = useRef<Set<string>>(new Set());
  const [curriculumDirty, setCurriculumDirty] = useState(false);

  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  const loadCurriculum = useCallback(
    async (supabase: import("@supabase/supabase-js").SupabaseClient) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modRes = await (supabase.from("modules") as any)
        .select("id, course_id, title, position")
        .eq("course_id", id)
        .order("position", { ascending: true });
      if (modRes.error) throw modRes.error;
      const mods = (modRes.data ?? []) as unknown as ModuleRow[];
      let lessons: LessonRow[] = [];
      if (mods.length) {
        const ids = mods.map((m) => m.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lesRes = await (supabase.from("lessons") as any)
          .select("id, module_id, title, position, video_url, content")
          .in("module_id", ids)
          .order("position", { ascending: true });
        if (lesRes.error) throw lesRes.error;
        lessons = (lesRes.data ?? []) as unknown as LessonRow[];
      }
      const nodes: ModuleNode[] = mods.map((m) => ({
        ...m,
        lessons: lessons
          .filter((l) => l.module_id === m.id)
          .map((l) => ({ ...l, content: l.content ?? {} })),
      }));
      return nodes;
    },
    [id]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: row, error } = await (supabase.from("courses") as any)
          .select("id, title, description, price_cents, cover_image_url, is_published")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!row) {
          if (!cancelled) setLoadState("not-found");
          return;
        }
        const r = row as unknown as {
          title: string;
          description: string | null;
          price_cents: number;
          cover_image_url: string | null;
          is_published: boolean;
        };
        const nodes = await loadCurriculum(supabase);
        if (cancelled) return;
        const firstLesson = nodes[0]?.lessons[0]?.id ?? null;
        setTitle(r.title);
        setDescription(r.description ?? "");
        setPriceDollars(centsToDollars(r.price_cents));
        setCoverImageUrl(r.cover_image_url ?? "");
        setIsPublished(r.is_published);
        setModules(nodes);
        setExpanded(Object.fromEntries(nodes.map((m) => [m.id, true])));
        setSelectedLessonId(firstLesson);
        setLastSnapshot(
          JSON.stringify({
            title: r.title,
            description: r.description ?? "",
            price_cents: r.price_cents,
            cover_image_url: r.cover_image_url ?? "",
            is_published: r.is_published,
          })
        );
        setLoadState("ready");
      } catch (e) {
        if (!cancelled) {
          setLoadState("error");
          setLoadError(e instanceof Error ? e.message : "Failed to load course");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadCurriculum]);

  /* ------------------------- course details save ------------------------ */

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        description,
        price_cents: dollarsToCents(priceDollars),
        cover_image_url: coverImageUrl,
        is_published: isPublished,
      }),
    [title, description, priceDollars, coverImageUrl, isPublished]
  );
  const detailsDirty = lastSnapshot !== snapshot;

  async function saveDetails() {
    setSaving(true);
    setSaveState("idle");
    setSaveError(null);
    try {
      if (!title.trim()) throw new Error("Give the course a title");
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("courses") as any)
        .update({
          title: title.trim(),
          description: description || null,
          price_cents: dollarsToCents(priceDollars),
          cover_image_url: coverImageUrl || null,
          is_published: isPublished,
        })
        .eq("id", id);
      if (error) throw error;
      setLastSnapshot(snapshot);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Failed to save");
      console.error("course save failed", e);
    } finally {
      setSaving(false);
    }
  }

  const dirty = detailsDirty || curriculumDirty;

  /** Flush every pending (debounced) module/lesson change immediately. */
  async function flushPending() {
    for (const id of Array.from(pendingLessonsRef.current)) {
      if (lessonSaveTimers.current[id]) {
        clearTimeout(lessonSaveTimers.current[id]);
        delete lessonSaveTimers.current[id];
      }
      await persistLesson(id);
    }
    for (const id of Array.from(pendingModulesRef.current)) {
      if (moduleRenameTimers.current[id]) {
        clearTimeout(moduleRenameTimers.current[id]);
        delete moduleRenameTimers.current[id];
      }
      await writeModule(id);
    }
    setCurriculumDirty(pendingLessonsRef.current.size > 0 || pendingModulesRef.current.size > 0);
  }

  /** Header Save — course details + any pending curriculum changes. */
  async function saveAll() {
    if (saving) return;
    setSaving(true);
    setSaveState("idle");
    setSaveError(null);
    try {
      if (detailsDirty) await saveDetails();
      await flushPending();
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Failed to save");
      console.error("course save failed", e);
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------- curriculum helpers ------------------------ */

  async function refreshCurriculum(supabase: import("@supabase/supabase-js").SupabaseClient) {
    const nodes = await loadCurriculum(supabase);
    setModules(nodes);
    setExpanded((prev) => {
      const next = { ...prev };
      for (const m of nodes) if (next[m.id] === undefined) next[m.id] = true;
      return next;
    });
    setSelectedLessonId((current) =>
      current && nodes.some((m) => m.lessons.some((l) => l.id === current)) ? current : null
    );
  }

  async function runOp(op: (supabase: import("@supabase/supabase-js").SupabaseClient) => Promise<void>) {
    if (opBusy) return;
    setOpBusy(true);
    setOpError(null);
    setOpOk(false);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await op(supabase);
      await refreshCurriculum(supabase);
      setOpOk(true);
      if (opOkTimer.current) clearTimeout(opOkTimer.current);
      opOkTimer.current = setTimeout(() => setOpOk(false), 2500);
    } catch (e) {
      const err = e as { message?: string };
      console.error("outline op failed", e);
      setOpError(err?.message || "Something went wrong — check the console.");
    } finally {
      setOpBusy(false);
    }
  }

  async function addModule() {
    await runOp(async (supabase) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("modules") as any).insert({
        course_id: id,
        title: "New module",
        position: modules.length,
      });
      if (error) throw error;
    });
  }

  async function renameModule(moduleId: string, value: string) {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, title: value } : m)));
    pendingModulesRef.current.add(moduleId);
    setCurriculumDirty(true);
    if (moduleRenameTimers.current[moduleId]) clearTimeout(moduleRenameTimers.current[moduleId]);
    moduleRenameTimers.current[moduleId] = setTimeout(async () => {
      try {
        await writeModule(moduleId);
      } finally {
        delete moduleRenameTimers.current[moduleId];
      }
    }, 600);
  }

  async function writeModule(moduleId: string) {
    const mod = modulesRef.current.find((m) => m.id === moduleId);
    if (!mod) return;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("modules") as any).update({ title: mod.title }).eq("id", moduleId);
      if (error) {
        setOpError(error.message || "Couldn't rename module");
        console.error("module rename failed", error);
      } else {
        pendingModulesRef.current.delete(moduleId);
        setCurriculumDirty(pendingLessonsRef.current.size > 0 || pendingModulesRef.current.size > 0);
      }
    } catch (e) {
      console.error("module write failed", e);
    }
  }

  async function persistModuleOrder(orderedIds: string[]) {
    await runOp(async (supabase) => {
      for (let p = 0; p < orderedIds.length; p++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("modules") as any)
          .update({ position: p })
          .eq("id", orderedIds[p]);
        if (error) throw error;
      }
    });
  }

  async function persistLessonOrder(moduleId: string, orderedIds: string[]) {
    await runOp(async (supabase) => {
      for (let p = 0; p < orderedIds.length; p++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from("lessons") as any)
          .update({ position: p })
          .eq("id", orderedIds[p]);
        if (error) throw error;
      }
    });
  }

  async function moveModule(moduleId: string, dir: -1 | 1) {
    const i = modules.findIndex((m) => m.id === moduleId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= modules.length) return;
    const ordered = modules.map((m) => m.id);
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    await persistModuleOrder(ordered);
  }

  async function deleteModule(moduleId: string) {
    await runOp(async (supabase) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("modules") as any).delete().eq("id", moduleId);
      if (error) throw error;
    });
  }

  async function addLesson(moduleId: string) {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    await runOp(async (supabase) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("lessons") as any)
        .insert({ module_id: moduleId, title: "New lesson", position: mod.lessons.length, content: {} })
        .select("id")
        .single();
      if (error) throw error;
      setSelectedLessonId((data as { id: string }).id);
    });
  }

  async function moveLesson(moduleId: string, lessonId: string, dir: -1 | 1) {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const i = mod.lessons.findIndex((l) => l.id === lessonId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= mod.lessons.length) return;
    const ordered = mod.lessons.map((l) => l.id);
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    await persistLessonOrder(moduleId, ordered);
  }

  async function deleteLesson(lessonId: string) {
    await runOp(async (supabase) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("lessons") as any).delete().eq("id", lessonId);
      if (error) throw error;
    });
  }

  /* --------------------------- drag & drop ---------------------------- */

  function clearDrag() {
    dragHandleRef.current = false;
    setDrag(null);
    setDropTarget(null);
  }

  async function dropModule(to: number) {
    if (!drag || drag.kind !== "module") return;
    if (drag.from === to) {
      clearDrag();
      return;
    }
    const ordered = modules.map((m) => m.id);
    const [moved] = ordered.splice(drag.from, 1);
    ordered.splice(to, 0, moved);
    clearDrag();
    await persistModuleOrder(ordered);
  }

  async function dropLesson(moduleId: string, to: number) {
    if (!drag || drag.kind !== "lesson" || drag.moduleId !== moduleId) return;
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    if (drag.from === to) {
      clearDrag();
      return;
    }
    const ordered = mod.lessons.map((l) => l.id);
    const [moved] = ordered.splice(drag.from, 1);
    ordered.splice(to, 0, moved);
    clearDrag();
    await persistLessonOrder(moduleId, ordered);
  }

  /** Debounced persist for lesson title / description / video fields. */
  function scheduleLessonSave(lessonId: string, patch: Partial<LessonRow>) {
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
      }))
    );
    pendingLessonsRef.current.add(lessonId);
    setCurriculumDirty(true);
    if (lessonSaveTimers.current[lessonId]) clearTimeout(lessonSaveTimers.current[lessonId]);
    lessonSaveTimers.current[lessonId] = setTimeout(() => {
      delete lessonSaveTimers.current[lessonId];
      void persistLesson(lessonId);
    }, 500);
  }

  async function persistLesson(lessonId: string) {
    const lesson = modulesRef.current.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    if (!lesson) return;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("lessons") as any)
        .update({
          title: lesson.title,
          video_url: lesson.video_url,
          content: { ...lesson.content, description: lessonDescription(lesson) },
        })
        .eq("id", lessonId);
      if (error) {
        setOpError(error.message || "Couldn't save lesson");
        console.error("lesson save failed", error);
      } else {
        pendingLessonsRef.current.delete(lessonId);
        setCurriculumDirty(pendingLessonsRef.current.size > 0 || pendingModulesRef.current.size > 0);
      }
    } catch (e) {
      console.error("lesson persist failed", e);
    }
  }

  async function removeCourse(): Promise<boolean> {
    setDeleting(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("courses") as any).delete().eq("id", id);
      if (error) throw error;
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
      return false;
    } finally {
      setDeleting(false);
    }
  }

  /* ------------------------------- render ------------------------------ */

  if (loadState !== "ready") {
    return (
      <div className="py-16 text-center">
        {loadState === "loading" ? (
          <p className="text-sm text-zinc-500">Loading course…</p>
        ) : loadState === "not-found" ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-zinc-500">This course doesn&rsquo;t exist or was deleted.</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/courses">Back to courses</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-red-600">{loadError || "Something went wrong."}</p>
        )}
      </div>
    );
  }

  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  const selectedLesson = selectedLessonId
    ? modules.flatMap((m) => m.lessons).find((l) => l.id === selectedLessonId) ?? null
    : null;
  const selectedModule = selectedLesson
    ? modules.find((m) => m.id === selectedLesson.module_id) ?? null
    : null;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="sm" className="text-zinc-500 shrink-0">
            <Link href="/dashboard/courses">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0">
              {coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverImageUrl} alt="" className="h-9 w-14 rounded-md border border-zinc-200 object-cover" />
              ) : (
                <span className="flex h-9 w-14 items-center justify-center rounded-md bg-zinc-100 text-zinc-400">
                  <BookOpen className="h-4 w-4" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                {title || "Untitled course"}
              </h1>
              <p className="text-xs text-zinc-400">
                {modules.length} module{modules.length === 1 ? "" : "s"} · {lessonCount} lesson
                {lessonCount === 1 ? "" : "s"}
              </p>
            </div>
            <Badge variant={isPublished ? "default" : "secondary"} className="shrink-0">
              {isPublished ? "Live" : "Draft"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {dirty ? (
            <span className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />
          ) : saveState === "saved" ? (
            <span className="text-xs text-emerald-600">Saved</span>
          ) : null}
          {saveState === "error" ? (
            <span className="text-xs text-red-600 max-w-[240px] text-right break-words">{saveError}</span>
          ) : null}
          <Button size="sm" disabled={saving || !dirty} onClick={saveAll}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-red-600"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete course"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-5 flex items-center gap-1 border-b border-zinc-200">
        {(
          [
            ["outline", "Outline"],
            ["settings", "Settings"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === key
                ? "border-zinc-900 font-medium text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        /* ------------------------- Settings (Kajabi-style) ------------------------- */
        <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <Label className="text-zinc-800">Published</Label>
              <p className="text-xs text-zinc-400">
                Published courses are shown on your storefront.
              </p>
            </div>
            <Switch
              checked={isPublished}
              onCheckedChange={(v) => {
                setIsPublished(v);
                setSaveState("idle");
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-700">Title</Label>
            <Input value={title} onChange={(e) => { setTitle(e.target.value); setSaveState("idle"); }} placeholder="e.g. Launch Your Storefront" />
          </div>
          <TextAreaField
            label="Description"
            value={description}
            onChange={(v) => { setDescription(v); setSaveState("idle"); }}
            rows={4}
            placeholder="What is it, who is it for, what will students be able to do?"
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-zinc-700">Price (USD)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                onChange={(e) => { setPriceDollars(e.target.value); setSaveState("idle"); }}
                placeholder="99"
                className="max-w-[160px]"
              />
              <span className="text-sm text-zinc-400">= {formatPrice(dollarsToCents(priceDollars))}</span>
            </div>
          </div>
          <UploadField
            label="Thumbnail"
            hint="Uploaded thumbnails are public — shown on your storefront."
            kind="image"
            bucket="uploads"
            pathPrefix="course-covers"
            value={coverImageUrl}
            onChange={(v) => { setCoverImageUrl(v); setSaveState("idle"); }}
          />
        </div>
      ) : (
        /* ------------------------- Outline (Kajabi-style) ------------------------- */
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Drag the handle (⋮⋮) to reorder modules and lessons. Changes autosave — click
              <span className="font-medium"> Save</span> in the header to save right now.
            </p>
            <div className="flex items-center gap-3">
              {opOk ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              ) : null}
              {opError ? (
                <span className="flex max-w-[340px] items-start gap-1 text-xs text-red-600 text-right break-words">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {opError}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            {/* Outline tree */}
            <div className="w-full lg:w-[380px] shrink-0">
              <div className="flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Course outline
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {modules.length} modules · {lessonCount} lessons
                  </span>
                </div>

                <div className="flex max-h-[calc(100vh-320px)] min-h-[320px] flex-col overflow-y-auto">
                  {modules.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                      <FolderOpen className="h-7 w-7 text-zinc-300" />
                      <div>
                        <p className="text-sm font-medium text-zinc-700">Start your course</p>
                        <p className="text-xs text-zinc-400 mt-1 max-w-[230px]">
                          Modules group your lessons (e.g. &ldquo;Module 1 — Foundations&rdquo;).
                        </p>
                      </div>
                    </div>
                  ) : (
                    modules.map((mod, mi) => {
                      const isOpen = expanded[mod.id] !== false;
                      const modDropActive =
                        drag?.kind === "module" && dropTarget?.kind === "module" && dropTarget.to === mi;
                      return (
                        <div key={mod.id} className="border-b border-zinc-100 last:border-b-0">
                          {/* Module row */}
                          <div
                            draggable={!opBusy}
                            onDragStart={(e) => {
                              if (!dragHandleRef.current) {
                                e.preventDefault();
                                return;
                              }
                              setDrag({ kind: "module", from: mi });
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={clearDrag}
                            onDragOver={(e) => {
                              if (drag?.kind !== "module") return;
                              e.preventDefault();
                              setDropTarget({ kind: "module", to: mi });
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              void dropModule(mi);
                            }}
                            className={cn(
                              "flex items-center gap-1 border-b border-zinc-100 bg-zinc-50/40 px-1.5 py-1.5",
                              modDropActive && "ring-2 ring-inset ring-zinc-900/60"
                            )}
                          >
                            <DragHandle
                              onMouseDown={() => {
                                dragHandleRef.current = true;
                              }}
                              onMouseUp={() => {
                                dragHandleRef.current = false;
                              }}
                            />
                            <button
                              type="button"
                              className="rounded p-0.5 text-zinc-400 hover:text-zinc-600"
                              aria-label={isOpen ? "Collapse module" : "Expand module"}
                              onClick={() => setExpanded((p) => ({ ...p, [mod.id]: !isOpen }))}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <FolderOpen className="h-4 w-4 shrink-0 text-zinc-400" />
                            <Input
                              value={mod.title}
                              onChange={(e) => renameModule(mod.id, e.target.value)}
                              className="h-7 flex-1 border-transparent bg-transparent px-1.5 text-sm font-medium text-zinc-900 shadow-none hover:bg-white/80 focus:bg-white focus:border-zinc-300"
                            />
                            <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{mod.lessons.length}</span>
                            <MiniIconButton
                              label="Move module up"
                              disabled={mi === 0 || opBusy}
                              onClick={() => void moveModule(mod.id, -1)}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </MiniIconButton>
                            <MiniIconButton
                              label="Move module down"
                              disabled={mi === modules.length - 1 || opBusy}
                              onClick={() => void moveModule(mod.id, 1)}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </MiniIconButton>
                            <MiniIconButton
                              label="Delete module"
                              danger
                              disabled={opBusy}
                              onClick={() => void deleteModule(mod.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </MiniIconButton>
                          </div>

                          {/* Lessons */}
                          {isOpen ? (
                            <ul className="flex flex-col gap-0.5 px-1 py-1">
                              {mod.lessons.map((lesson, li) => {
                                const active = selectedLessonId === lesson.id;
                                const lesDropActive =
                                  drag?.kind === "lesson" &&
                                  drag.moduleId === mod.id &&
                                  dropTarget?.kind === "lesson" &&
                                  dropTarget.to === li;
                                return (
                                  <li
                                    key={lesson.id}
                                    draggable={!opBusy}
                                    onDragStart={(e) => {
                                      if (!dragHandleRef.current) {
                                        e.preventDefault();
                                        return;
                                      }
                                      setDrag({ kind: "lesson", moduleId: mod.id, from: li });
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEnd={clearDrag}
                                    onDragOver={(e) => {
                                      if (drag?.kind !== "lesson" || drag.moduleId !== mod.id) return;
                                      e.preventDefault();
                                      setDropTarget({ kind: "lesson", moduleId: mod.id, to: li });
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      void dropLesson(mod.id, li);
                                    }}
                                    onClick={() => setSelectedLessonId(lesson.id)}
                                    className={cn(
                                      "group flex items-center gap-1 rounded-lg px-1 py-1 text-sm cursor-pointer",
                                      active
                                        ? "bg-zinc-100 font-medium text-zinc-900"
                                        : "text-zinc-600 hover:bg-zinc-50",
                                      lesDropActive && "ring-2 ring-inset ring-zinc-900/60"
                                    )}
                                  >
                                    <DragHandle
                                      onMouseDown={() => {
                                        dragHandleRef.current = true;
                                      }}
                                      onMouseUp={() => {
                                        dragHandleRef.current = false;
                                      }}
                                    />
                                    {lesson.video_url ? (
                                      <Play className={cn("h-3.5 w-3.5 shrink-0", active ? "text-zinc-700" : "text-zinc-400")} />
                                    ) : (
                                      <FileText className={cn("h-3.5 w-3.5 shrink-0", active ? "text-zinc-700" : "text-zinc-400")} />
                                    )}
                                    <span className="flex-1 truncate">{lesson.title || "Untitled lesson"}</span>
                                    <span className="flex shrink-0 opacity-0 group-hover:opacity-100">
                                      <MiniIconButton
                                        label="Move lesson up"
                                        disabled={li === 0 || opBusy}
                                        onClick={() => void moveLesson(mod.id, lesson.id, -1)}
                                      >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                      </MiniIconButton>
                                      <MiniIconButton
                                        label="Move lesson down"
                                        disabled={li === mod.lessons.length - 1 || opBusy}
                                        onClick={() => void moveLesson(mod.id, lesson.id, 1)}
                                      >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      </MiniIconButton>
                                      <MiniIconButton
                                        label="Delete lesson"
                                        danger
                                        disabled={opBusy}
                                        onClick={() => void deleteLesson(lesson.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </MiniIconButton>
                                    </span>
                                  </li>
                                );
                              })}
                              {/* Append-to-module drop zone + add lesson */}
                              <li
                                onDragOver={(e) => {
                                  if (drag?.kind !== "lesson" || drag.moduleId !== mod.id) return;
                                  e.preventDefault();
                                  setDropTarget({ kind: "lesson", moduleId: mod.id, to: mod.lessons.length });
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  void dropLesson(mod.id, mod.lessons.length);
                                }}
                                className={cn(
                                  "rounded-lg",
                                  drag?.kind === "lesson" &&
                                    drag.moduleId === mod.id &&
                                    dropTarget?.kind === "lesson" &&
                                    dropTarget.to === mod.lessons.length &&
                                    "bg-zinc-100"
                                )}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-center gap-1.5 border border-dashed border-transparent py-1.5 text-xs text-zinc-400 hover:border-zinc-300 hover:text-zinc-700"
                                  disabled={opBusy}
                                  onClick={() => void addLesson(mod.id)}
                                >
                                  <Plus className="h-3.5 w-3.5" /> Add lesson
                                </Button>
                              </li>
                            </ul>
                          ) : null}
                        </div>
                      );
                    })
                  )}

                  {/* Append-to-end + add module */}
                  <div
                    onDragOver={(e) => {
                      if (drag?.kind !== "module") return;
                      e.preventDefault();
                      setDropTarget({ kind: "module", to: modules.length });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      void dropModule(modules.length);
                    }}
                    className={cn("p-2", drag?.kind === "module" && dropTarget?.kind === "module" && dropTarget.to === modules.length && "bg-zinc-100")}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center gap-1.5 border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
                      disabled={opBusy}
                      onClick={addModule}
                    >
                      <Plus className="h-4 w-4" /> Add module
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: selected lesson editor */}
            <div className="flex-1 min-w-0">
              {selectedLesson ? (
                <LessonPanel
                  key={selectedLesson.id}
                  courseId={id}
                  moduleTitle={selectedModule?.title ?? ""}
                  lesson={selectedLesson}
                  onChange={(patch) => scheduleLessonSave(selectedLesson.id, patch)}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-300 py-16 flex flex-col items-center gap-3 text-center px-6">
                  <FileText className="h-7 w-7 text-zinc-300" />
                  <div>
                    <p className="text-sm font-medium text-zinc-700">{modules.length ? "Select a lesson" : "Add your first module"}</p>
                    <p className="text-xs text-zinc-400 mt-1 max-w-[260px]">
                      {modules.length
                        ? "Pick a lesson in the outline to edit its title, notes, and video."
                        : "Modules group lessons — add one to start building your course."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete course dialog */}
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-zinc-900">Delete &ldquo;{title}&rdquo;?</h2>
            <p className="mt-1 text-sm text-zinc-500">
              This permanently removes the course, its modules, and every lesson video
              reference. This can&rsquo;t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const ok = await removeCourse();
                  if (ok) router.replace("/dashboard/courses");
                  else setConfirmDelete(false);
                }}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete course
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lesson editor panel                                                */
/* ------------------------------------------------------------------ */

function LessonPanel({
  courseId,
  moduleTitle,
  lesson,
  onChange,
}: {
  courseId: string;
  moduleTitle: string;
  lesson: LessonRow;
  onChange: (patch: Partial<LessonRow>) => void;
}) {
  const [resolved, setResolved] = useState<{ value: string; url: string } | null>(null);
  const [resolveError, setResolveError] = useState<{ value: string; message: string } | null>(null);

  const source = parseLessonVideo(lesson.video_url);
  const privatePath = source?.kind === "private" ? source.path : null;
  const isPrivateUpload = source?.kind === "private";
  const material = useMemo(() => normalizeLessonMaterial(lesson.content?.material), [lesson.content]);
  // External links render directly; private uploads resolve a signed URL async.
  const previewUrl =
    source?.kind === "external"
      ? source.url
      : resolved && resolved.value === lesson.video_url
        ? resolved.url
        : null;
  const previewError =
    resolveError && resolveError.value === lesson.video_url ? resolveError.message : null;

  useEffect(() => {
    if (!privatePath) return;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const url = await signedObjectUrl(supabase, "course-videos", privatePath);
        if (!cancelled) setResolved({ value: lesson.video_url ?? privatePath, url });
      } catch (e) {
        if (!cancelled) {
          setResolveError({
            value: lesson.video_url ?? privatePath,
            message: e instanceof Error ? e.message : "Couldn't load the private video preview.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [privatePath, lesson.video_url]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-400 truncate">
          {moduleTitle ? <span className="font-medium text-zinc-500">{moduleTitle}</span> : null}
          {moduleTitle ? <span className="mx-1.5">/</span> : null}
          {lesson.title || "Untitled lesson"}
        </p>
        <Badge variant="outline" className="shrink-0 text-zinc-400 font-normal">
          {isPrivateUpload ? "video uploaded" : lesson.video_url ? "video linked" : "no video"}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-zinc-700">Title</Label>
        <Input
          value={lesson.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="text-base font-medium"
          placeholder="Lesson title"
        />
      </div>

      <TextAreaField
        label="Notes for students"
        value={lessonDescription(lesson)}
        onChange={(d) =>
          onChange({ content: { ...lesson.content, description: d } as Record<string, unknown> })
        }
        rows={4}
        placeholder="What should students take away from this lesson?"
      />

      {/* Video */}
      <div className="flex flex-col gap-2">
        <Label className="text-zinc-700">Lesson video</Label>
        <UploadField
          label="Video file"
          hint={
            isPrivateUpload
              ? "Uploaded videos are stored privately — only you (and later, enrolled students) can watch."
              : "Upload an mp4/webm or paste a direct link."
          }
          kind="video"
          bucket="course-videos"
          pathPrefix={`courses/${courseId}/${lesson.id}`}
          value={lesson.video_url ?? ""}
          onChange={(video_url) => onChange({ video_url: video_url || null })}
        />
      </div>

      {/* Read-only lesson material: PDF or quiz */}
      <div className="flex flex-col gap-2.5 border-t border-zinc-100 pt-4">
        <Label className="text-zinc-700">Lesson material</Label>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-1">
          {(
            [
              ["none", "None", null],
              ["pdf", "PDF", FileType2],
              ["quiz", "Quiz", ListChecks],
            ] as const
          ).map(([key, label, Icon]) => {
            const active =
              (key === "none" && !material) ||
              (key === "pdf" && material?.kind === "pdf") ||
              (key === "quiz" && material?.kind === "quiz");
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onChange({
                    content: {
                      ...lesson.content,
                      material:
                        key === "none"
                          ? null
                          : key === "pdf"
                            ? ({ kind: "pdf", url: "" } as LessonMaterial)
                            : ({ kind: "quiz", questions: [makeQuizQuestion()] } as LessonMaterial),
                    },
                  })
                }
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium",
                  active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {label}
              </button>
            );
          })}
        </div>

        {material?.kind === "pdf" ? (
          <PdfMaterialEditor
            courseId={courseId}
            lessonId={lesson.id}
            url={material.url}
            onChange={(url) =>
              onChange({ content: { ...lesson.content, material: url ? { kind: "pdf", url } : null } })
            }
          />
        ) : null}
        {material?.kind === "quiz" ? (
          <QuizEditor
            questions={material.questions}
            onChange={(questions) =>
              onChange({ content: { ...lesson.content, material: { kind: "quiz", questions } } })
            }
          />
        ) : null}
      </div>

      {previewError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {previewError}. Make sure the Phase 4 migration (storage policies) has been applied.
        </div>
      ) : null}
      {previewUrl && isPrivateUpload ? (
        <div>
          <p className="mb-1.5 text-xs text-zinc-400">Preview — private upload, visible to you:</p>
          <VideoEmbed videoUrl={previewUrl} title={lesson.title || "Lesson video"} className="rounded-xl ring-1 ring-zinc-100" />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only PDF + quiz editor                                         */
/* ------------------------------------------------------------------ */

function PdfMaterialEditor({
  courseId,
  lessonId,
  url,
  onChange,
}: {
  courseId: string;
  lessonId: string;
  url: string;
  onChange: (url: string) => void;
}) {
  const [resolved, setResolved] = useState<{ value: string; url: string } | null>(null);
  const [resolveError, setResolveError] = useState<{ value: string; message: string } | null>(null);
  const isHttp = /^https?:\/\//i.test(url.trim());
  const isPrivatePath = !isHttp && !!url;
  // External URLs render directly; private course-files uploads resolve a signed URL async.
  const previewUrl = isHttp ? url : resolved && resolved.value === url ? resolved.url : null;
  const error = resolveError && resolveError.value === url ? resolveError.message : null;

  useEffect(() => {
    if (!isPrivatePath) return;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const signed = await signedObjectUrl(supabase, "course-files", url);
        if (!cancelled) setResolved({ value: url, url: signed });
      } catch (e) {
        if (!cancelled) {
          setResolveError({
            value: url,
            message: e instanceof Error ? e.message : "Couldn't load the PDF preview.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, isPrivatePath]);

  return (
    <div className="flex flex-col gap-3">
      <UploadField
        label="PDF file"
        hint="Upload a PDF — stored privately; students can read it inline (downloads disabled)."
        kind="file"
        bucket="course-files"
        pathPrefix={`courses/${courseId}/${lessonId}`}
        accept="application/pdf"
        allowPaste={false}
        value={url}
        onChange={onChange}
      />
      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}. Make sure the course-files migration (storage policies) has been applied.
        </p>
      ) : null}
      {previewUrl ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <FileText className="h-3.5 w-3.5" /> Read-only preview
            </p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              Downloads disabled
            </span>
          </div>
          <PdfViewer url={previewUrl} title="Lesson PDF" />
        </div>
      ) : url ? (
        <p className="text-xs text-zinc-400">Loading preview…</p>
      ) : null}
    </div>
  );
}

function PdfViewer({ url, title }: { url: string; title: string }) {
  // Hide the browser PDF toolbar so save/print affordances aren't displayed.
  // (A convenience, not DRM — anyone who can view it can copy the signed URL.)
  const src = `${url.split("#")[0]}#toolbar=0&view=FitH`;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      <iframe src={src} title={title} className="h-[480px] w-full" />
    </div>
  );
}

function QuizEditor({
  questions,
  onChange,
}: {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}) {
  const missingAnswers = questions.filter(
    (q) => q.correctIndex < 0 || q.correctIndex >= q.options.length
  ).length;

  function updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  return (
    <div className="flex flex-col gap-3">
      {missingAnswers > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {missingAnswers} question{missingAnswers === 1 ? "" : "s"} still need
          {missingAnswers === 1 ? "s" : ""} a correct answer marked.
        </p>
      ) : null}

      {questions.map((q, qi) => (
        <div key={q.id} className="flex flex-col gap-2.5 rounded-lg border border-zinc-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-semibold text-white">
              {qi + 1}
            </span>
            <Input
              value={q.prompt}
              placeholder="Question"
              onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
              className="flex-1 text-sm"
            />
            <MiniIconButton
              label="Delete question"
              danger
              onClick={() => onChange(questions.filter((x) => x.id !== q.id))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </MiniIconButton>
          </div>

          <div className="flex flex-col gap-1.5 pl-8">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <button
                  type="button"
                  title={q.correctIndex === oi ? "Correct answer" : "Mark as correct"}
                  onClick={() => updateQuestion(q.id, { correctIndex: oi })}
                  className={cn(
                    "shrink-0 rounded-full p-0.5",
                    q.correctIndex === oi ? "text-emerald-500" : "text-zinc-300 hover:text-zinc-500"
                  )}
                >
                  {q.correctIndex === oi ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>
                <Input
                  value={opt}
                  placeholder={`Option ${oi + 1}`}
                  onChange={(e) =>
                    updateQuestion(q.id, { options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })
                  }
                  className="flex-1 text-sm"
                />
                {q.options.length > 2 ? (
                  <button
                    type="button"
                    aria-label="Remove option"
                    onClick={() =>
                      updateQuestion(q.id, {
                        options: q.options.filter((_, j) => j !== oi),
                        correctIndex:
                          q.correctIndex === oi
                            ? -1
                            : q.correctIndex > oi
                              ? q.correctIndex - 1
                              : q.correctIndex,
                      })
                    }
                    className="shrink-0 text-zinc-300 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
            {q.options.length < 6 ? (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start gap-1 self-start text-xs text-zinc-400 hover:text-zinc-700"
                onClick={() => updateQuestion(q.id, { options: [...q.options, ""] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add option
              </Button>
            ) : null}
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="border-dashed text-zinc-500"
        onClick={() => onChange([...questions, makeQuizQuestion()])}
      >
        <Plus className="h-3.5 w-3.5" /> Add question
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DragHandle({
  onMouseDown,
  onMouseUp,
}: {
  onMouseDown: () => void;
  onMouseUp: () => void;
}) {
  return (
    <span
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      className="cursor-grab rounded p-0.5 text-zinc-300 hover:text-zinc-500 active:cursor-grabbing"
      title="Drag to reorder"
      aria-hidden
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}

function MiniIconButton({
  label,
  children,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 text-zinc-400 hover:bg-zinc-200/70", danger && "hover:text-red-600")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}