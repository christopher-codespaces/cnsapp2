"use client";

import { useRef, useState } from "react";
import { ImagePlus, Video, FileText, X, Loader2 } from "lucide-react";
import { Field } from "@/components/builder/fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadObject } from "@/lib/storage";

/**
 * Builder field that either uploads a file to Supabase Storage or pastes a
 * URL. Used for VSL thumbnails, testimonial media, and course covers.
 *
 * Value semantics (see lib/storage.ts): public buckets store the full public
 * URL (it renders on logged-out public pages); private buckets store the bare
 * object path.
 */
export default function UploadField({
  label,
  hint,
  value,
  onChange,
  kind = "file",
  bucket = "uploads",
  pathPrefix = "storefront",
  accept,
  allowPaste = true,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  kind?: "image" | "video" | "file";
  bucket?: "uploads" | "avatars" | "course-videos" | "course-files";
  /** Category folder under the owner's user id, e.g. "storefront/vsl". */
  pathPrefix?: string;
  accept?: string;
  /** Hide the "…or paste a URL" input — upload-only field. */
  allowPaste?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedAccept = accept ?? (kind === "image" ? "image/*" : kind === "video" ? "video/*" : undefined);
  const UploadIcon = kind === "image" ? ImagePlus : kind === "video" ? Video : FileText;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You need to be signed in to upload");
      const { path, url } = await uploadObject({
        supabase,
        bucket,
        folder: `${user.id}/${pathPrefix}`,
        file,
      });
      // Public buckets store the full URL; private buckets store the object
      // path (resolved to a signed URL when it's viewed).
      onChange(url ?? path);
    } catch (e) {
      const err = e as { message?: string };
      console.error("upload failed", e);
      setError(err?.message || "Upload failed — check the file type and size.");
    } finally {
      setUploading(false);
    }
  }

  const isHttp = /^https?:\/\//i.test(value.trim());

  return (
    <Field label={label} hint={hint} className={className}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex-1 border-dashed text-zinc-600"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <UploadIcon className="h-4 w-4" />
              Upload file
            </>
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={resolvedAccept}
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-zinc-400 hover:text-red-600"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {value && kind === "image" && isHttp ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 h-32 w-full rounded-lg border border-zinc-200 object-cover" />
      ) : null}
      {value && kind === "video" && isHttp ? (
        <video
          src={value}
          controls
          preload="metadata"
          className="mt-2 aspect-video w-full rounded-lg border border-zinc-200 bg-zinc-950 object-cover"
        />
      ) : null}
      {value && !isHttp ? (
        <p className="mt-1.5 truncate rounded-md bg-zinc-100 px-2.5 py-1.5 font-mono text-[11px] text-zinc-500">
          {value}
        </p>
      ) : null}

      {allowPaste ? (
        <Input
          value={isHttp ? value : ""}
          placeholder="…or paste a URL"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </Field>
  );
}
