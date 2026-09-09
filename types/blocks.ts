// =============================================================================
// CNS Creator OS — Block & section JSON shapes
// -----------------------------------------------------------------------------
// Shared by the Storefront Builder, the Landing Page Builder, their public
// renderers, and (Phase 4/5) the AI Workspace tool actions. Keep these shapes
// stable and documented: the AI will need to generate this exact jsonb later.
//
//  * storefronts.sections   -> StorefrontSections  (fixed set of canonical
//    sections keyed by name; ordering is fixed by STOREFRONT_SECTION_ORDER so
//    jsonb key ordering is never relied on).
//  * landing_pages.content  -> { blocks: Block[] } (top-level object leaves
//    room for future page-level settings without breaking the block list).
// =============================================================================

// ---------------------------------------------------------------------------
// Landing page block types
// ---------------------------------------------------------------------------

export const BLOCK_TYPES = [
  "heading",
  "text",
  "image",
  "cta_button",
  "testimonial",
  "faq",
  "signup_form",
  "spacer",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export type TextAlign = "left" | "center";

interface BlockBase {
  id: string;
  type: BlockType;
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  align: TextAlign;
}

export interface TextBlock extends BlockBase {
  type: "text";
  body: string;
  align: TextAlign;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  url: string;
  alt: string;
  caption: string;
}

export interface CtaBlock extends BlockBase {
  type: "cta_button";
  label: string;
  href: string;
  align: TextAlign;
}

export interface TestimonialBlock extends BlockBase {
  type: "testimonial";
  quote: string;
  author: string;
  role: string;
}

export interface FaqBlock extends BlockBase {
  type: "faq";
  heading: string;
  items: { q: string; a: string }[];
}

export interface SignupFormBlock extends BlockBase {
  type: "signup_form";
  heading: string;
  body: string;
  cta_label: string;
  align: TextAlign;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number; // px
}

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | CtaBlock
  | TestimonialBlock
  | FaqBlock
  | SignupFormBlock
  | SpacerBlock;

/** Landing page `content` jsonb shape. */
export interface LandingContent {
  blocks: Block[];
}

export type LandingPageType =
  | "sales"
  | "webinar"
  | "lead_magnet"
  | "waitlist"
  | "thank_you"
  | "vsl"
  | "launch";

export const LANDING_PAGE_TYPES: LandingPageType[] = [
  "sales",
  "webinar",
  "lead_magnet",
  "waitlist",
  "thank_you",
  "vsl",
  "launch",
];

export const LANDING_PAGE_TYPE_LABELS: Record<LandingPageType, string> = {
  sales: "Sales page",
  webinar: "Webinar",
  lead_magnet: "Lead magnet",
  waitlist: "Waitlist",
  thank_you: "Thank you",
  vsl: "Video sales letter",
  launch: "Launch",
};

// ---------------------------------------------------------------------------
// Storefront sections
// ---------------------------------------------------------------------------

export interface Cta {
  label: string;
  href: string;
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  /** Optional "student result" screenshot / photo shown above the quote. */
  image_url?: string;
  /** Optional video of the result (Loom / YouTube / Vimeo link) shown above the quote. */
  video_url?: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export const SOCIAL_PLATFORMS = [
  "x",
  "instagram",
  "youtube",
  "tiktok",
  "linkedin",
  "facebook",
  "website",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  x: "X / Twitter",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  website: "Website",
};

export interface SocialItem {
  platform: SocialPlatform;
  url: string;
  label: string;
}

interface BaseSection {
  enabled: boolean;
}

export interface HeroSection extends BaseSection {
  badge: string;
  headline: string;
  subheadline: string;
  cta_primary: Cta;
  cta_secondary: Cta;
  image_url: string;
  align: "left" | "center";
}

export interface AboutSection extends BaseSection {
  heading: string;
  body: string;
  image_url: string;
}

/** Video sales letter section — embeds a Loom / YouTube / Vimeo video. */
export interface VslSection extends BaseSection {
  heading: string;
  subheadline: string;
  /** Loom share link, YouTube or Vimeo URL (converted to an embed automatically). */
  video_url: string;
  /** Poster image shown over the video until the visitor presses play. */
  thumbnail_url: string;
  /** Optional button below the video (e.g. "Get started now"). Empty label hides it. */
  cta_label: string;
  cta_href: string;
}

/** Shared by the products + courses sections (real listings arrive in Phase 3). */
export interface CollectionSection extends BaseSection {
  heading: string;
  intro: string;
}

export interface TestimonialsSection extends BaseSection {
  heading: string;
  items: TestimonialItem[];
}

export interface FaqSection extends BaseSection {
  heading: string;
  items: FaqItem[];
}

export interface EmailSignupSection extends BaseSection {
  heading: string;
  body: string;
  cta_label: string;
}

export interface SocialLinksSection extends BaseSection {
  heading: string;
  items: SocialItem[];
}

export interface ContactSection extends BaseSection {
  heading: string;
  body: string;
  email: string;
}

export interface FooterSection extends BaseSection {
  text: string;
}

export interface StorefrontSections {
  hero: HeroSection;
  vsl: VslSection;
  about: AboutSection;
  products: CollectionSection;
  courses: CollectionSection;
  testimonials: TestimonialsSection;
  faq: FaqSection;
  email_signup: EmailSignupSection;
  social_links: SocialLinksSection;
  contact: ContactSection;
  footer: FooterSection;
}

export type StorefrontSectionKey = keyof StorefrontSections;

/** Row subset of products/courses rendered as cards on the storefront. */
export interface CatalogItem {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  cover_image_url: string | null;
}

/** Canonical display order for storefront sections (jsonb key order is not relied on). */
export const STOREFRONT_SECTION_ORDER: (keyof StorefrontSections)[] = [
  "hero",
  "vsl",
  "about",
  "products",
  "courses",
  "testimonials",
  "faq",
  "email_signup",
  "social_links",
  "contact",
  "footer",
];

export const STOREFRONT_SECTION_LABELS: Record<keyof StorefrontSections, string> = {
  hero: "Hero",
  vsl: "Video (VSL)",
  about: "About",
  products: "Products",
  courses: "Courses",
  testimonials: "Testimonials",
  faq: "FAQ",
  email_signup: "Email signup",
  social_links: "Social links",
  contact: "Contact",
  footer: "Footer",
};

// ---------------------------------------------------------------------------
// Small tolerant coercion helpers (partial/legacy/AI-generated jsonb)
// ---------------------------------------------------------------------------

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function arr<T>(v: unknown, map: (item: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const item of v) {
    const mapped = map(item);
    if (mapped) out.push(mapped);
  }
  return out;
}

function cta(v: unknown): Cta {
  const o = (v ?? {}) as Record<string, unknown>;
  return { label: str(o.label), href: str(o.href) };
}

function align(v: unknown): "left" | "center" {
  return v === "center" ? "center" : "left";
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Storefront section defaults + normalizers
// ---------------------------------------------------------------------------

const emptyFaqItems = (): FaqItem[] => [];
const emptyTestimonials = (): TestimonialItem[] => [];
const emptySocial = (): SocialItem[] => [];

/** Fresh storefront sections with sensible defaults. Optional brand name is used in the hero. */
export function defaultStorefrontSections(brandName?: string): StorefrontSections {
  return {
    hero: {
      enabled: true,
      badge: "",
      headline: brandName ? `Welcome to ${brandName}` : "",
      subheadline: "",
      cta_primary: { label: "Get started", href: "" },
      cta_secondary: { label: "Learn more", href: "" },
      image_url: "",
      align: "center",
    },
    about: { enabled: false, heading: "About", body: "", image_url: "" },
    vsl: {
      enabled: false,
      heading: "Watch this first",
      subheadline: "",
      video_url: "",
      thumbnail_url: "",
      cta_label: "",
      cta_href: "",
    },
    products: { enabled: false, heading: "Products", intro: "" },
    courses: { enabled: false, heading: "Courses", intro: "" },
    testimonials: { enabled: false, heading: "What people say", items: emptyTestimonials() },
    faq: { enabled: false, heading: "Frequently asked questions", items: emptyFaqItems() },
    email_signup: { enabled: false, heading: "Stay in the loop", body: "", cta_label: "Subscribe" },
    social_links: { enabled: false, heading: "Follow along", items: emptySocial() },
    contact: { enabled: false, heading: "Get in touch", body: "", email: "" },
    footer: { enabled: true, text: "" },
  };
}

function normalizeHero(raw: unknown, fallback: HeroSection): HeroSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    badge: str(o.badge, fallback.badge),
    headline: str(o.headline, fallback.headline),
    subheadline: str(o.subheadline, fallback.subheadline),
    cta_primary: cta(o.cta_primary ?? fallback.cta_primary),
    cta_secondary: cta(o.cta_secondary ?? fallback.cta_secondary),
    image_url: str(o.image_url, fallback.image_url),
    align: o.align === "left" ? "left" : fallback.align === "left" ? "left" : "center",
  };
}

function normalizeFaqItems(raw: unknown): FaqItem[] {
  return arr(raw, (item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const q = str(o.q);
    const a = str(o.a);
    if (!q && !a) return null;
    return { q, a };
  });
}

function normalizeTestimonials(raw: unknown): TestimonialItem[] {
  return arr(raw, (item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const quote = str(o.quote);
    if (!quote) return null;
    const imageUrl = str(o.image_url);
    const videoUrl = str(o.video_url);
    const out: TestimonialItem = { quote, author: str(o.author), role: str(o.role) };
    if (imageUrl) out.image_url = imageUrl;
    if (videoUrl) out.video_url = videoUrl;
    return out;
  });
}

function normalizeSocial(raw: unknown): SocialItem[] {
  return arr(raw, (item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const platform = String(o.platform ?? "") as SocialPlatform;
    if (!SOCIAL_PLATFORMS.includes(platform)) return null;
    return { platform, url: str(o.url), label: str(o.label) };
  });
}

/**
 * Merge raw `storefronts.sections` jsonb over a fresh default set, tolerating
 * partial/legacy/AI-generated data so the renderers never crash on bad jsonb.
 */
export function normalizeStorefrontSections(raw: unknown, brandName?: string): StorefrontSections {
  const defaults = defaultStorefrontSections(brandName);
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const get = <K extends keyof StorefrontSections>(key: K, fallback: StorefrontSections[K]): StorefrontSections[K] => {
    const v = o[key];
    if (v === undefined || v === null) return fallback;
    return v as StorefrontSections[K];
  };

  return {
    hero: normalizeHero(get("hero", defaults.hero), defaults.hero),
    vsl: normalizeVsl(get("vsl", defaults.vsl), defaults.vsl),
    about: normalizeAbout(get("about", defaults.about), defaults.about),
    products: normalizeCollection(get("products", defaults.products), defaults.products),
    courses: normalizeCollection(get("courses", defaults.courses), defaults.courses),
    testimonials: normalizeTestimonialsSection(get("testimonials", defaults.testimonials), defaults.testimonials),
    faq: normalizeFaqSection(get("faq", defaults.faq), defaults.faq),
    email_signup: normalizeEmailSignup(get("email_signup", defaults.email_signup), defaults.email_signup),
    social_links: normalizeSocialLinks(get("social_links", defaults.social_links), defaults.social_links),
    contact: normalizeContact(get("contact", defaults.contact), defaults.contact),
    footer: normalizeFooter(get("footer", defaults.footer), defaults.footer),
  };
}

function normalizeAbout(raw: unknown, fallback: AboutSection): AboutSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    body: str(o.body, fallback.body),
    image_url: str(o.image_url, fallback.image_url),
  };
}

function normalizeVsl(raw: unknown, fallback: VslSection): VslSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    subheadline: str(o.subheadline, fallback.subheadline),
    video_url: str(o.video_url, fallback.video_url),
    thumbnail_url: str(o.thumbnail_url, fallback.thumbnail_url),
    cta_label: str(o.cta_label, fallback.cta_label),
    cta_href: str(o.cta_href, fallback.cta_href),
  };
}

function normalizeCollection(raw: unknown, fallback: CollectionSection): CollectionSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    intro: str(o.intro, fallback.intro),
  };
}

function normalizeTestimonialsSection(raw: unknown, fallback: TestimonialsSection): TestimonialsSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    items: normalizeTestimonials(o.items),
  };
}

function normalizeFaqSection(raw: unknown, fallback: FaqSection): FaqSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    items: normalizeFaqItems(o.items),
  };
}

function normalizeEmailSignup(raw: unknown, fallback: EmailSignupSection): EmailSignupSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    body: str(o.body, fallback.body),
    cta_label: str(o.cta_label, fallback.cta_label),
  };
}

function normalizeSocialLinks(raw: unknown, fallback: SocialLinksSection): SocialLinksSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    items: normalizeSocial(o.items),
  };
}

function normalizeContact(raw: unknown, fallback: ContactSection): ContactSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    heading: str(o.heading, fallback.heading),
    body: str(o.body, fallback.body),
    email: str(o.email, fallback.email),
  };
}

function normalizeFooter(raw: unknown, fallback: FooterSection): FooterSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, fallback.enabled),
    text: str(o.text, fallback.text),
  };
}

// ---------------------------------------------------------------------------
// Landing page block defaults + normalizers
// ---------------------------------------------------------------------------

/** Create a brand-new block of the given type with a fresh id. */
export function makeBlock(type: BlockType): Block {
  const id = makeId();
  switch (type) {
    case "heading":
      return { id, type, text: "New heading", level: 2, align: "left" };
    case "text":
      return { id, type, body: "", align: "left" };
    case "image":
      return { id, type, url: "", alt: "", caption: "" };
    case "cta_button":
      return { id, type, label: "Get started", href: "", align: "left" };
    case "testimonial":
      return { id, type, quote: "", author: "", role: "" };
    case "faq":
      return { id, type, heading: "", items: [] };
    case "signup_form":
      return { id, type, heading: "", body: "", cta_label: "Subscribe", align: "center" };
    case "spacer":
      return { id, type, height: 48 };
  }
}

/** Coerce a raw jsonb object into a known block (unknown shapes -> null). */
export function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type as BlockType;
  const id = str(o.id) || makeId();
  switch (type) {
    case "heading":
      return {
        id,
        type,
        text: str(o.text, "Heading"),
        level: (o.level === 1 ? 1 : o.level === 3 ? 3 : 2) as 1 | 2 | 3,
        align: align(o.align),
      };
    case "text":
      return { id, type, body: str(o.body), align: align(o.align) };
    case "image":
      return { id, type, url: str(o.url), alt: str(o.alt), caption: str(o.caption) };
    case "cta_button":
      return { id, type, label: str(o.label, "Get started"), href: str(o.href), align: align(o.align) };
    case "testimonial":
      return { id, type, quote: str(o.quote), author: str(o.author), role: str(o.role) };
    case "faq":
      return { id, type, heading: str(o.heading), items: normalizeFaqItems(o.items) };
    case "signup_form":
      return {
        id,
        type,
        heading: str(o.heading),
        body: str(o.body),
        cta_label: str(o.cta_label, "Subscribe"),
        align: o.align === "left" ? "left" : "center",
      };
    case "spacer":
      return { id, type, height: num(o.height, 48) };
    default:
      return null;
  }
}

/** Parse landing page `content` jsonb (either {blocks: [...]} or a bare array). */
export function normalizeLandingContent(raw: unknown): LandingContent {
  let list: unknown = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).blocks)) {
    list = (raw as Record<string, unknown>).blocks;
  }
  const blocks = arr(list, normalizeBlock);
  return { blocks };
}

/** Initial block layout for a newly created landing page, keyed by page type. */
export function defaultLandingBlocks(type: LandingPageType, title: string): LandingContent {
  const h1 = makeBlock("heading") as HeadingBlock;
  h1.text = title;
  h1.level = 1;
  h1.align = "center";

  const text = makeBlock("text") as TextBlock;
  const cta = makeBlock("cta_button") as CtaBlock;
  cta.align = "center";

  const signup = makeBlock("signup_form") as SignupFormBlock;

  switch (type) {
    case "lead_magnet": {
      text.body = "Drop your email below and we'll send it straight to your inbox.";
      signup.heading = "Get the free download";
      return { blocks: [h1, text, signup] };
    }
    case "waitlist": {
      text.body = "Join the waitlist to get first access when we open the doors.";
      signup.heading = "Join the waitlist";
      signup.cta_label = "Join the waitlist";
      return { blocks: [h1, text, signup] };
    }
    case "thank_you": {
      text.body = "Thanks — your request has been received. Keep an eye on your inbox.";
      return { blocks: [h1, text] };
    }
    case "webinar": {
      text.body = "Reserve your seat for the live session.";
      cta.label = "Reserve my seat";
      return { blocks: [h1, text, cta] };
    }
    case "sales": {
      text.body = "Everything you need to know, in one place.";
      cta.label = "Get it now";
      return { blocks: [h1, text, cta] };
    }
    case "vsl": {
      text.body = "Watch the video below, then grab it while it's still available.";
      return { blocks: [h1, text, cta] };
    }
    case "launch": {
      text.body = "Something big is on the way. Be the first to know when it launches.";
      cta.label = "Notify me";
      return { blocks: [h1, text, cta, signup] };
    }
  }
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Pull a color out of the freeform brand_colors jsonb (e.g. "primary": "#3b82f6"). */
export function brandColor(colors: unknown, key: string, fallback: string): string {
  const o = colors && typeof colors === "object" ? (colors as Record<string, unknown>) : {};
  const v = o[key];
  if (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  return fallback;
}
