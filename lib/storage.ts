// =============================================================================
// CNS Creator OS — Supabase Storage helpers
// -----------------------------------------------------------------------------
// Shared by the builder upload fields (VSL thumbnails, testimonial media,
// course covers, lesson videos). Owner convention: the first folder segment of
// every object path is the authenticated user's id (matches the storage RLS
// policies in the Phase 4 migration).
//
//  * Public buckets (uploads, avatars) -> the field stores the full public URL
//    (public pages render these with no auth).
//  * Private buckets (course-videos, product-files) -> the field stores the
//    bare object path; consumers resolve a short-lived signed URL when needed.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export const PUBLIC_BUCKETS = new Set(["uploads", "avatars"]);

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}

/** "My Great Video (final).MP4" -> "my-great-video-final.mp4" */
export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const safeExt = /^[a-z0-9]{1,8}$/i.test(ext) ? ext.toLowerCase() : "";
  return `${clean || "file"}${safeExt ? `.${safeExt}` : ""}`;
}

/** Upload a file under `folder` and return its path (+ public URL when public). */
export async function uploadObject({
  supabase,
  bucket,
  folder,
  file,
}: {
  supabase: SupabaseClient;
  bucket: string;
  folder: string;
  file: File;
}): Promise<{ path: string; url: string | null }> {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const path = `${cleanFolder}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  if (isPublicBucket(bucket)) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }
  return { path, url: null };
}

/** True when the string is a full http(s) URL rather than a storage path. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * Interpret a lesson's stored `video_url`:
 *  - http(s) URL  -> external/direct source (pasted link or public upload).
 *  - anything else -> object path inside the private `course-videos` bucket.
 */
export type LessonVideoSource =
  | { kind: "external"; url: string }
  | { kind: "private"; path: string };

export function parseLessonVideo(value: string | null): LessonVideoSource | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (isHttpUrl(v)) return { kind: "external", url: v };
  return { kind: "private", path: v };
}

const signedCache = new Map<string, { url: string; expiresAt: number }>();

/** Short-lived signed URL for a private object (owner-only, via their RLS). */
export async function signedObjectUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  ttlSeconds = 3600
): Promise<string> {
  const key = `${bucket}/${path}`;
  const cached = signedCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
  if (error) throw error;
  signedCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + ttlSeconds * 1000 });
  return data.signedUrl;
}
