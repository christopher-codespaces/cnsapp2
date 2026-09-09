"use client";

import { Quote } from "lucide-react";
import {
  Block,
  HeadingBlock,
  TextBlock,
  ImageBlock,
  CtaBlock,
  TestimonialBlock,
  FaqBlock,
  SignupFormBlock,
  LandingContent,
} from "@/types/blocks";
import EmailCaptureForm from "@/components/builder/EmailCaptureForm";
import { cn } from "@/lib/utils";

/**
 * Presentational renderer for a landing page's block content. Used by BOTH the
 * landing page editor's live preview and the public /lp/[handle]/[slug] page,
 * so the editor preview is pixel-faithful to what goes live.
 */
export default function LpRenderer({
  content,
  brandName = "",
  logoUrl,
  creatorId = null,
  sourceId = null,
  className,
}: {
  content: LandingContent;
  brandName?: string;
  logoUrl?: string | null;
  creatorId?: string | null;
  sourceId?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("bg-white text-zinc-900", className)}>
      {content.blocks.map((block) => (
        <BlockView
          key={block.id}
          block={block}
          creatorId={creatorId}
          sourceId={sourceId}
        />
      ))}
      {brandName ? (
        <footer className="mt-10 border-t border-zinc-100 py-8">
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-6">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
            ) : null}
            <span className="text-sm text-zinc-400">{brandName}</span>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

export function BlockView({
  block,
  creatorId,
  sourceId,
}: {
  block: Block;
  creatorId: string | null;
  sourceId: string | null;
}) {
  switch (block.type) {
    case "heading":
      return <HeadingView block={block} />;
    case "text":
      return <TextView block={block} />;
    case "image":
      return <ImageView block={block} />;
    case "cta_button":
      return <CtaView block={block} />;
    case "testimonial":
      return <TestimonialView block={block} />;
    case "faq":
      return <FaqBlockView block={block} />;
    case "signup_form":
      return <SignupView block={block} creatorId={creatorId} sourceId={sourceId} />;
    case "spacer":
      return <div style={{ height: block.height }} aria-hidden />;
    default:
      return null;
  }
}

function Wrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-2xl px-6", className)}>{children}</div>;
}

const headingSizes: Record<HeadingBlock["level"], string> = {
  1: "mt-12 text-4xl sm:text-5xl font-bold tracking-tight leading-tight",
  2: "mt-10 text-3xl font-bold tracking-tight",
  3: "mt-8 text-2xl font-semibold tracking-tight",
};

export function HeadingView({ block }: { block: HeadingBlock }) {
  const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
  const align = block.align === "center" ? "text-center" : "text-left";
  if (!block.text) return null;
  return (
    <Wrap>
      <Tag className={cn(headingSizes[block.level], align)}>{block.text}</Tag>
    </Wrap>
  );
}

export function TextView({ block }: { block: TextBlock }) {
  if (!block.body) return null;
  return (
    <Wrap>
      <p
        className={cn(
          "mt-5 text-lg text-zinc-600 whitespace-pre-line",
          block.align === "center" && "text-center"
        )}
      >
        {block.body}
      </p>
    </Wrap>
  );
}

export function ImageView({ block }: { block: ImageBlock }) {
  if (!block.url) return null;
  return (
    <Wrap>
      <figure className="mt-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.url}
          alt={block.alt || ""}
          className="w-full rounded-xl border border-zinc-100 object-cover"
        />
        {block.caption ? (
          <figcaption className="mt-2 text-center text-sm text-zinc-400">{block.caption}</figcaption>
        ) : null}
      </figure>
    </Wrap>
  );
}

export function CtaView({ block }: { block: CtaBlock }) {
  if (!block.label) return null;
  const cls =
    "mt-8 inline-flex items-center justify-center rounded-md bg-zinc-900 px-8 py-3.5 text-sm font-medium text-white hover:bg-zinc-700";
  if (block.href) {
    return (
      <Wrap>
        <a
          href={block.href}
          target={block.href.startsWith("http") ? "_blank" : undefined}
          rel={block.href.startsWith("http") ? "noreferrer" : undefined}
          className={cn(cls, block.align === "center" && "flex mx-auto")}
        >
          {block.label}
        </a>
      </Wrap>
    );
  }
  return (
    <Wrap className={block.align === "center" ? "flex justify-center" : ""}>
      <span className={cls}>{block.label}</span>
    </Wrap>
  );
}

export function TestimonialView({ block }: { block: TestimonialBlock }) {
  if (!block.quote) return null;
  return (
    <Wrap>
      <figure className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50/70 p-6 flex flex-col gap-3">
        <Quote className="h-5 w-5 text-zinc-300" />
        <blockquote className="text-zinc-700 whitespace-pre-line">{block.quote}</blockquote>
        {block.author || block.role ? (
          <figcaption className="text-sm text-zinc-500">
            {block.author}
            {block.author && block.role ? " — " : ""}
            {block.role}
          </figcaption>
        ) : null}
      </figure>
    </Wrap>
  );
}

export function FaqBlockView({ block }: { block: FaqBlock }) {
  if (!block.items.length) return null;
  return (
    <Wrap>
      {block.heading ? <h2 className="mt-10 text-2xl font-semibold tracking-tight">{block.heading}</h2> : null}
      <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
        {block.items.map(
          (item, i) =>
            (item.q || item.a) && (
              <details key={i} className="group py-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-zinc-900">
                  {item.q}
                  <span className="text-zinc-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                </summary>
                {item.a ? <p className="mt-2 text-zinc-500 whitespace-pre-line">{item.a}</p> : null}
              </details>
            )
        )}
      </div>
    </Wrap>
  );
}

export function SignupView({
  block,
  creatorId,
  sourceId,
}: {
  block: SignupFormBlock;
  creatorId: string | null;
  sourceId: string | null;
}) {
  const alignCls = block.align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <Wrap>
      <div
        className={cn(
          "mt-10 flex max-w-xl flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm",
          alignCls
        )}
      >
        {block.heading ? <h2 className="text-2xl font-semibold tracking-tight">{block.heading}</h2> : null}
        {block.body ? <p className="text-zinc-500 whitespace-pre-line">{block.body}</p> : null}
        <div className="mt-4 w-full">
          <EmailCaptureForm
            creatorId={creatorId}
            sourceId={sourceId}
            ctaLabel={block.cta_label || "Subscribe"}
          />
        </div>
      </div>
    </Wrap>
  );
}
