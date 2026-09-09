"use client";

import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";
import { isDirectVideoUrl, toEmbedUrl, withQuery } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Click-to-play video embed shared by the storefront VSL section and media
 * testimonials (and used by BOTH the builder preview and the public page).
 *
 *  - Paste any Loom / YouTube / Vimeo share link.
 *  - Optional poster thumbnail: shown until the visitor presses play (keeps
 *    the page fast — the iframe only mounts on click).
 *  - Unrecognized links fall back to a plain "Watch video" outbound button.
 */
export default function VideoEmbed({
  videoUrl,
  thumbnailUrl,
  title = "Video",
  aspect = "16:9",
  className,
}: {
  videoUrl: string;
  thumbnailUrl?: string | null;
  title?: string;
  /** 16:9 landscape (VSL, lessons) or 9:16 portrait (testimonial videos). */
  aspect?: "16:9" | "9:16";
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const embed = toEmbedUrl(videoUrl);
  const aspectClass = aspect === "9:16" ? "aspect-[9/16]" : "aspect-video";

  // Direct video file (e.g. an uploaded mp4) -> plain <video> with a poster.
  // object-cover keeps every source filling the frame (no letterbox bars).
  if (!embed && isDirectVideoUrl(videoUrl)) {
    return (
      <div className={cn("relative w-full overflow-hidden rounded-xl bg-zinc-950", aspectClass, className)}>
        <video
          key={videoUrl}
          src={videoUrl}
          poster={thumbnailUrl || undefined}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  if (!embed) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800",
          aspectClass,
          className
        )}
      >
        <Play className="h-5 w-5" fill="currentColor" />
        Watch video
        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
      </a>
    );
  }

  return (
    <div className={cn("relative w-full overflow-hidden bg-zinc-950", aspectClass, className)}>
      {playing ? (
        <iframe
          src={withQuery(embed, { autoplay: "1" })}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title}`}
          className="group absolute inset-0 flex items-center justify-center"
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : null}
          <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/25" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg ring-1 ring-black/10 transition-transform group-hover:scale-105">
            <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
