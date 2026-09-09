// =============================================================================
// CNS Creator OS — video link helpers
// -----------------------------------------------------------------------------
// Converts paste-friendly share links (Loom, YouTube, Vimeo) into embeddable
// iframe URLs. Kept in its own module so both the storefront VSL section and
// testimonial videos (and any later builder) share one parser.
// =============================================================================

export type VideoProvider = "loom" | "youtube" | "vimeo" | "generic";

/** Best-effort label of what kind of link the user pasted (for editor hints). */
export function detectVideoProvider(raw: string): VideoProvider | null {
  const url = raw.trim();
  if (!url) return null;
  if (/loom\.com\//i.test(url)) return "loom";
  if (/(youtube\.com|youtu\.be)/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/^https?:\/\//i.test(url)) return "generic";
  return null;
}

const YT_ID = "[A-Za-z0-9_-]{6,}";

/**
 * Convert a share URL into an iframe-src embed URL. Returns null when the link
 * isn't recognized (callers can fall back to a plain outbound link).
 *
 * Supported:
 *  - Loom:   https://www.loom.com/share/<id>  (embed is loom.com/embed/<id>)
 *  - YouTube: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
 *  - Vimeo:   vimeo.com/<id>
 *  - Any URL already pointing at an /embed/ iframe (passthrough).
 */
export function toEmbedUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;

  // Passthrough: already an embed / iframe src (Wistia, Bunny, …).
  if (/\/embed\//i.test(url)) return url;

  let m: RegExpMatchArray | null;

  m = url.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9_-]{6,})/i);
  if (m) return `https://www.loom.com/embed/${m[1]}`;

  m = url.match(new RegExp(`youtube\.com\/watch\?[^#]*\bv=(${YT_ID})`, "i"));
  if (!m) m = url.match(new RegExp(`youtu\.be\/(${YT_ID})`, "i"));
  if (!m) m = url.match(new RegExp(`youtube\.com\/(?:shorts|live|embed)\/(${YT_ID})`, "i"));
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;

  m = url.match(/vimeo\.com\/(?:video\/)?(\d{5,})/i);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;

  return null;
}

/** True for direct video files (mp4/webm/mov/…) — played in a plain <video>. */
export function isDirectVideoUrl(raw: string): boolean {
  const url = raw.trim().toLowerCase();
  return /^https?:\/\//i.test(url) && /\.(mp4|webm|ogg|mov|m4v)(?:[?#]|$)/.test(url);
}

/** Append extra query params to an embed URL without disturbing existing ones. */
export function withQuery(src: string, params: Record<string, string>): string {
  try {
    const u = new URL(src);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return `${src}${src.includes("?") ? "&" : "?"}${qs}`;
  }
}
