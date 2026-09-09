"use client";

import {
  Quote,
  Link2,
  Mail,
  ArrowRight,
} from "lucide-react";
import {
  CatalogItem,
  StorefrontSections,
  STOREFRONT_SECTION_ORDER,
  STOREFRONT_SECTION_LABELS,
  SocialPlatform,
  TestimonialItem,
  brandColor,
} from "@/types/blocks";
import EmailCaptureForm from "@/components/builder/EmailCaptureForm";
import VideoEmbed from "@/components/builder/VideoEmbed";
import BuyButton from "@/components/storefront/BuyButton";
import AccountButton from "@/components/storefront/AccountButton";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Presentational renderer for a published storefront. Used by BOTH:
 *  1. the builder's live preview pane (app/dashboard/storefront), and
 *  2. the public page app/c/[handle] (server-fetched, rendered here).
 * Because both use this same component, what you edit is exactly what goes live.
 *
 * Section order is the canonical STOREFRONT_SECTION_ORDER — jsonb never drives order.
 */
export default function StorefrontRenderer({
  sections,
  brandName = "",
  logoUrl,
  colors,
  creatorId = null,
  products = [],
  courses = [],
  className,
}: {
  sections: StorefrontSections;
  brandName?: string;
  logoUrl?: string | null;
  colors?: Record<string, unknown>;
  creatorId?: string | null;
  /** Published products/courses from the DB — rendered as cards. */
  products?: CatalogItem[];
  courses?: CatalogItem[];
  className?: string;
}) {
  const primary = brandColor(colors, "primary", "#18181b");
  const year = new Date().getFullYear();

  return (
    <div className={cn("bg-white text-zinc-900", className)}>
      {/* Masthead */}
      <header className="border-b border-zinc-100">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-7 w-7 rounded object-contain" />
            ) : null}
            <span className="font-semibold text-zinc-900 truncate">{brandName}</span>
          </div>
          <AccountButton />
        </div>
      </header>

      {STOREFRONT_SECTION_ORDER.map((key) => {
        const section = sections[key];
        if (!section.enabled) return null;
        switch (key) {
          case "hero": {
            const s = sections.hero;
            return <HeroView key={key} hero={s} primary={primary} />;
          }
          case "vsl": {
            const s = sections.vsl;
            return <VslView key={key} section={s} primary={primary} />;
          }
          case "about": {
            const s = sections.about;
            return <AboutView key={key} section={s} />;
          }
          case "products": {
            const s = sections.products;
            return (
              <CollectionView
                key={key}
                section={s}
                defaultHeading="Products"
                items={products}
                kind="product"
                creatorId={creatorId}
              />
            );
          }
          case "courses": {
            const s = sections.courses;
            return (
              <CollectionView
                key={key}
                section={s}
                defaultHeading="Courses"
                items={courses}
                kind="course"
                creatorId={creatorId}
              />
            );
          }
          case "testimonials": {
            const s = sections.testimonials;
            return <TestimonialsView key={key} section={s} />;
          }
          case "faq": {
            const s = sections.faq;
            return <FaqView key={key} section={s} />;
          }
          case "email_signup": {
            const s = sections.email_signup;
            return <EmailSignupView key={key} section={s} creatorId={creatorId} />;
          }
          case "social_links": {
            const s = sections.social_links;
            return <SocialView key={key} section={s} />;
          }
          case "contact": {
            const s = sections.contact;
            return <ContactView key={key} section={s} />;
          }
          case "footer": {
            const s = sections.footer;
            return (
              <footer key={key} className="border-t border-zinc-100 py-8">
                <div className="mx-auto max-w-5xl px-6 text-center text-sm text-zinc-400">
                  {s.text || `© ${year} ${brandName || "Storefront"}`}
                </div>
              </footer>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SectionShell({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <section aria-label={label} className={cn("px-6 py-16 sm:py-20", className)}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

function CtaButton({
  label,
  href,
  primaryColor,
  kind,
}: {
  label: string;
  href: string;
  primaryColor?: string;
  kind: "primary" | "ghost";
}) {
  const cls =
    kind === "primary"
      ? "inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-medium text-white hover:opacity-90"
      : "inline-flex items-center gap-2 rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50";
  const inner = (
    <>
      {label}
      {kind === "primary" ? <ArrowRight className="h-4 w-4" /> : null}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        className={cls}
        style={kind === "primary" ? { backgroundColor: primaryColor } : undefined}
      >
        {inner}
      </a>
    );
  }
  return (
    <span
      className={cn(cls, kind === "primary" ? "opacity-100" : "")}
      style={kind === "primary" ? { backgroundColor: primaryColor } : undefined}
    >
      {label}
    </span>
  );
}

function HeroView({
  hero,
  primary,
}: {
  hero: StorefrontSections["hero"];
  primary: string;
}) {
  const headline = hero.headline;
  const content = (
    <>
      {hero.badge ? (
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
          {hero.badge}
        </span>
      ) : null}
      {headline ? (
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 leading-tight">
          {headline}
        </h1>
      ) : null}
      {hero.subheadline ? (
        <p className="mt-4 text-lg text-zinc-500 max-w-2xl whitespace-pre-line">
          {hero.subheadline}
        </p>
      ) : null}
      {(hero.cta_primary.label || hero.cta_secondary.label) && (
        <div className="mt-8 flex flex-wrap gap-3">
          {hero.cta_primary.label ? (
            <CtaButton
              label={hero.cta_primary.label}
              href={hero.cta_primary.href}
              primaryColor={primary}
              kind="primary"
            />
          ) : null}
          {hero.cta_secondary.label ? (
            <CtaButton label={hero.cta_secondary.label} href={hero.cta_secondary.href} kind="ghost" />
          ) : null}
        </div>
      )}
    </>
  );

  if (hero.align === "left" && hero.image_url) {
    return (
      <section aria-label="Hero" className="px-6 py-16 sm:py-24 bg-gradient-to-b from-zinc-50 to-white">
        <div className="mx-auto max-w-5xl grid items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col items-start">{content}</div>
          <MediaImage url={hero.image_url} className="rounded-xl" />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Hero" className="px-6 py-16 sm:py-24 bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
        {content}
        {hero.image_url ? <MediaImage url={hero.image_url} className="mt-10 rounded-xl" /> : null}
      </div>
    </section>
  );
}

function MediaImage({ url, className }: { url: string; className?: string }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={cn("w-full object-cover aspect-[4/3] border border-zinc-100 shadow-sm", className)}
    />
  );
}

function AboutView({ section }: { section: StorefrontSections["about"] }) {
  const hasImage = Boolean(section.image_url);
  return (
    <SectionShell label={STOREFRONT_SECTION_LABELS.about}>
      <div className={cn("grid gap-10 items-center", hasImage && "lg:grid-cols-2")}>
        <div className={cn("flex flex-col", !hasImage && "mx-auto max-w-2xl text-center items-center")}>
          {section.heading ? (
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">{section.heading}</h2>
          ) : null}
          {section.body ? (
            <p className="mt-4 text-lg text-zinc-500 whitespace-pre-line">{section.body}</p>
          ) : null}
        </div>
        {hasImage ? <MediaImage url={section.image_url} className="rounded-xl order-first lg:order-none" /> : null}
      </div>
    </SectionShell>
  );
}

function CollectionView({
  section,
  defaultHeading,
  items,
  kind,
  creatorId,
}: {
  section: StorefrontSections["products"] | StorefrontSections["courses"];
  defaultHeading: string;
  items: CatalogItem[];
  kind: "product" | "course";
  creatorId: string | null;
}) {
  const heading = section.heading || defaultHeading;
  if (!section.intro && !heading && !items.length) return null;
  return (
    <SectionShell label={heading} className="bg-zinc-50/70">
      <div className="flex flex-col items-center text-center">
        {heading ? (
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">{heading}</h2>
        ) : null}
        {section.intro ? (
          <p className="mt-4 text-lg text-zinc-500 max-w-2xl whitespace-pre-line">{section.intro}</p>
        ) : null}
      </div>
      {items.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CatalogCard key={item.id} item={item} kind={kind} creatorId={creatorId} />
          ))}
        </div>
      ) : null}
    </SectionShell>
  );
}

function CatalogCard({
  item,
  kind,
  creatorId,
}: {
  item: CatalogItem;
  kind: "product" | "course";
  creatorId: string | null;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-sm">
      {item.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.cover_image_url} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
          <span className="text-3xl font-bold text-zinc-300">
            {item.title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-semibold text-zinc-900 leading-snug">{item.title}</h3>
        {item.description ? (
          <p className="text-sm text-zinc-500 line-clamp-3 whitespace-pre-line">{item.description}</p>
        ) : null}
        <p className="pt-2 text-sm font-semibold text-zinc-900">{formatPrice(item.price_cents)}</p>
        <BuyButton
          kind={kind}
          itemId={item.id}
          title={item.title}
          priceCents={item.price_cents}
          creatorId={creatorId}
        />
      </div>
    </div>
  );
}

function VslView({
  section,
  primary,
}: {
  section: StorefrontSections["vsl"];
  primary: string;
}) {
  const hasVideo = Boolean(section.video_url);
  if (!hasVideo && !section.heading && !section.subheadline) return null;
  return (
    <SectionShell label={STOREFRONT_SECTION_LABELS.vsl}>
      <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
        {section.heading ? (
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">{section.heading}</h2>
        ) : null}
        {section.subheadline ? (
          <p className="mt-4 text-lg text-zinc-500 max-w-2xl whitespace-pre-line">{section.subheadline}</p>
        ) : null}
        {hasVideo ? (
          <div className="mt-8 w-full">
            <VideoEmbed
              videoUrl={section.video_url}
              thumbnailUrl={section.thumbnail_url || null}
              title={section.heading || "Video"}
              className="rounded-2xl shadow-sm ring-1 ring-zinc-100"
            />
          </div>
        ) : null}
        {section.cta_label ? (
          <div className="mt-8">
            <CtaButton
              label={section.cta_label}
              href={section.cta_href}
              primaryColor={primary}
              kind="primary"
            />
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

function TestimonialsView({ section }: { section: StorefrontSections["testimonials"] }) {
  if (!section.items.length) return null;
  return (
    <SectionShell label={STOREFRONT_SECTION_LABELS.testimonials} className="bg-zinc-50/70">
      {section.heading ? (
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 text-center">{section.heading}</h2>
      ) : null}
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {section.items.map((item, i) => (
          <TestimonialCard key={i} item={item} />
        ))}
      </div>
    </SectionShell>
  );
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {item.video_url ? (
        <div className="border-b border-zinc-100 bg-zinc-950/5 px-4 pt-4">
          <div className="mx-auto w-full max-w-[260px]">
            <VideoEmbed
              videoUrl={item.video_url}
              thumbnailUrl={item.image_url || null}
              title={`Testimonial — ${item.author || "customer"}`}
              aspect="9:16"
              className="rounded-xl"
            />
          </div>
        </div>
      ) : item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt="" className="h-44 w-full border-b border-zinc-100 object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <Quote className="h-5 w-5 text-zinc-300" />
        <blockquote className="text-zinc-700 whitespace-pre-line">{item.quote}</blockquote>
        {(item.author || item.role) && (
          <figcaption className="text-sm text-zinc-500 mt-auto">
            {item.author}
            {item.author && item.role ? " — " : ""}
            {item.role}
          </figcaption>
        )}
      </div>
    </figure>
  );
}

function FaqView({ section }: { section: StorefrontSections["faq"] }) {
  if (!section.items.length) return null;
  return (
    <SectionShell label={STOREFRONT_SECTION_LABELS.faq}>
      {section.heading ? (
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 text-center">{section.heading}</h2>
      ) : null}
      <div className="mx-auto mt-8 max-w-3xl divide-y divide-zinc-200 border-y border-zinc-200">
        {section.items.map(
          (item, i) =>
            (item.q || item.a) && (
              <details key={i} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-zinc-900">
                  {item.q}
                  <span className="text-zinc-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                {item.a ? (
                  <p className="mt-3 text-zinc-500 whitespace-pre-line">{item.a}</p>
                ) : null}
              </details>
            )
        )}
      </div>
    </SectionShell>
  );
}

function EmailSignupView({
  section,
  creatorId,
}: {
  section: StorefrontSections["email_signup"];
  creatorId: string | null;
}) {
  return (
    <SectionShell label={STOREFRONT_SECTION_LABELS.email_signup} className="bg-zinc-50/70">
      <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {section.heading ? (
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">{section.heading}</h2>
        ) : null}
        {section.body ? (
          <p className="mt-2 text-zinc-500 whitespace-pre-line">{section.body}</p>
        ) : null}
        <div className="mt-6 text-left">
          <EmailCaptureForm creatorId={creatorId} ctaLabel={section.cta_label || "Subscribe"} />
        </div>
      </div>
    </SectionShell>
  );
}

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  x: "X",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  website: "Website",
};

function SocialView({ section }: { section: StorefrontSections["social_links"] }) {
  if (!section.items.length) return null;
  return (
    <SectionShell label={STOREFRONT_SECTION_LABELS.social_links}>
      {section.heading ? (
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 text-center">{section.heading}</h2>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {section.items.map(
          (item, i) =>
            item.url && (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              >
                <Link2 className="h-4 w-4 text-zinc-400" />
                {item.label || PLATFORM_LABEL[item.platform]}
              </a>
            )
        )}
      </div>
    </SectionShell>
  );
}

function ContactView({ section }: { section: StorefrontSections["contact"] }) {
  if (!section.email && !section.body) return null;
  return (
    <SectionShell label={STOREFRONT_SECTION_LABELS.contact} className="bg-zinc-50/70">
      <div className="flex flex-col items-center text-center">
        {section.heading ? (
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">{section.heading}</h2>
        ) : null}
        {section.body ? (
          <p className="mt-4 text-lg text-zinc-500 max-w-2xl whitespace-pre-line">{section.body}</p>
        ) : null}
        {section.email ? (
          <a
            href={`mailto:${section.email}`}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            <Mail className="h-4 w-4" />
            {section.email}
          </a>
        ) : null}
      </div>
    </SectionShell>
  );
}
