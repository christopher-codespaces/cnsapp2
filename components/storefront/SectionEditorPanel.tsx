"use client";

import {
  StorefrontSections,
  StorefrontSectionKey,
  STOREFRONT_SECTION_LABELS,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  Cta,
  SocialPlatform,
} from "@/types/blocks";
import {
  Field,
  TextField,
  TextAreaField,
  ToggleField,
  ListItemCard,
  AddItemButton,
} from "@/components/builder/fields";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlignCenter, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toEmbedUrl } from "@/lib/media";
import UploadField from "@/components/builder/UploadField";

/**
 * Editor form for a single storefront section. `onChange` receives the next
 * full section object; the page merges it into the sections state.
 */
export function SectionEditorPanel({
  kind,
  section,
  onChange,
}: {
  kind: StorefrontSectionKey;
  section: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (kind) {
    case "hero": {
      const s = section as StorefrontSections["hero"];
      const patch = (p: Partial<StorefrontSections["hero"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField
            label="Show hero section"
            checked={s.enabled}
            onChange={(enabled) => patch({ enabled })}
          />
          <TextField label="Badge / eyebrow" value={s.badge} onChange={(badge) => patch({ badge })} placeholder="e.g. New — 2026 cohort open" />
          <TextField label="Headline" value={s.headline} onChange={(headline) => patch({ headline })} placeholder="Your headline" />
          <TextAreaField label="Subheadline" value={s.subheadline} onChange={(subheadline) => patch({ subheadline })} rows={3} />
          <CtaEditor label="Primary button" value={s.cta_primary} onChange={(cta_primary) => patch({ cta_primary })} />
          <CtaEditor label="Secondary button" value={s.cta_secondary} onChange={(cta_secondary) => patch({ cta_secondary })} />
          <TextField label="Hero image URL" value={s.image_url} onChange={(image_url) => patch({ image_url })} placeholder="https://…" hint="Shown beside the text (left layout) or below (centered)." />
          <Field label="Alignment">
            <div className="flex gap-2">
              <AlignButton active={s.align === "left"} onClick={() => patch({ align: "left" })}>
                <AlignLeft className="h-4 w-4" /> Left
              </AlignButton>
              <AlignButton active={s.align === "center"} onClick={() => patch({ align: "center" })}>
                <AlignCenter className="h-4 w-4" /> Center
              </AlignButton>
            </div>
          </Field>
        </div>
      );
    }
    case "vsl": {
      const s = section as StorefrontSections["vsl"];
      const patch = (p: Partial<StorefrontSections["vsl"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show video (VSL) section" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} placeholder="e.g. Watch how it works" />
          <TextAreaField label="Subheadline" value={s.subheadline} onChange={(subheadline) => patch({ subheadline })} rows={2} />
          <VideoUrlField label="Video link" value={s.video_url} onChange={(video_url) => patch({ video_url })} />
          <UploadField
            label="Thumbnail image"
            hint="Optional — shown until visitors press play; a dark player is used instead."
            kind="image"
            bucket="uploads"
            pathPrefix="storefront/vsl"
            value={s.thumbnail_url}
            onChange={(thumbnail_url) => patch({ thumbnail_url })}
          />
          <CtaEditor
            label="Button below video"
            value={{ label: s.cta_label, href: s.cta_href }}
            onChange={(cta) => patch({ cta_label: cta.label, cta_href: cta.href })}
          />
        </div>
      );
    }
    case "about": {
      const s = section as StorefrontSections["about"];
      const patch = (p: Partial<StorefrontSections["about"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show about section" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} />
          <TextAreaField label="Body" value={s.body} onChange={(body) => patch({ body })} rows={5} />
          <TextField label="Image URL" value={s.image_url} onChange={(image_url) => patch({ image_url })} />
        </div>
      );
    }
    case "products":
    case "courses": {
      const s = section as StorefrontSections["products"];
      const patch = (p: Partial<StorefrontSections["products"]>) => onChange({ ...s, ...p });
      const collectionLabel = kind === "products" ? "products" : "courses";
      return (
        <div className="flex flex-col gap-4">
          <ToggleField
            label={`Show ${collectionLabel} section`}
            checked={s.enabled}
            onChange={(enabled) => patch({ enabled })}
          />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} />
          <TextAreaField
            label="Intro text"
            value={s.intro}
            onChange={(intro) => patch({ intro })}
            hint={`Published ${collectionLabel} appear here automatically as cards.`}
          />
        </div>
      );
    }
    case "testimonials": {
      const s = section as StorefrontSections["testimonials"];
      const patch = (p: Partial<StorefrontSections["testimonials"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show testimonials section" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} />
          <div className="flex flex-col gap-3">
            {s.items.map((item, i) => (
              <ListItemCard key={i} onRemove={() => patch({ items: s.items.filter((_, j) => j !== i) })}>
                <TextAreaField label="Quote" value={item.quote} onChange={(quote) => patch({ items: s.items.map((it, j) => (j === i ? { ...it, quote } : it)) })} rows={2} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Author" value={item.author} onChange={(author) => patch({ items: s.items.map((it, j) => (j === i ? { ...it, author } : it)) })} />
                  <TextField label="Role" value={item.role} onChange={(role) => patch({ items: s.items.map((it, j) => (j === i ? { ...it, role } : it)) })} />
                </div>
                <div className="border-t border-zinc-100 pt-3 flex flex-col gap-3">
                  <UploadField
                    label="Result image"
                    hint="Optional photo / screenshot of the result, shown above the quote."
                    kind="image"
                    bucket="uploads"
                    pathPrefix="storefront/testimonials"
                    value={item.image_url ?? ""}
                    onChange={(image_url) =>
                      patch({ items: s.items.map((it, j) => (j === i ? { ...it, image_url: image_url || undefined } : it)) })
                    }
                  />
                  <UploadField
                    label="Result video"
                    hint="Optional — upload the video or paste a Loom / YouTube link."
                    kind="video"
                    bucket="uploads"
                    pathPrefix="storefront/testimonials"
                    value={item.video_url ?? ""}
                    onChange={(video_url) =>
                      patch({ items: s.items.map((it, j) => (j === i ? { ...it, video_url: video_url || undefined } : it)) })
                    }
                  />
                </div>
              </ListItemCard>
            ))}
            <AddItemButton
              label="Add testimonial"
              onClick={() => patch({ items: [...s.items, { quote: "", author: "", role: "" }] })}
            />
          </div>
        </div>
      );
    }
    case "faq": {
      const s = section as StorefrontSections["faq"];
      const patch = (p: Partial<StorefrontSections["faq"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show FAQ section" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} />
          <div className="flex flex-col gap-3">
            {s.items.map((item, i) => (
              <ListItemCard key={i} onRemove={() => patch({ items: s.items.filter((_, j) => j !== i) })}>
                <TextField label="Question" value={item.q} onChange={(q) => patch({ items: s.items.map((it, j) => (j === i ? { ...it, q } : it)) })} />
                <TextAreaField label="Answer" value={item.a} onChange={(a) => patch({ items: s.items.map((it, j) => (j === i ? { ...it, a } : it)) })} rows={2} />
              </ListItemCard>
            ))}
            <AddItemButton label="Add question" onClick={() => patch({ items: [...s.items, { q: "", a: "" }] })} />
          </div>
        </div>
      );
    }
    case "email_signup": {
      const s = section as StorefrontSections["email_signup"];
      const patch = (p: Partial<StorefrontSections["email_signup"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show email signup section" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} />
          <TextAreaField label="Body" value={s.body} onChange={(body) => patch({ body })} rows={2} />
          <TextField label="Button label" value={s.cta_label} onChange={(cta_label) => patch({ cta_label })} />
        </div>
      );
    }
    case "social_links": {
      const s = section as StorefrontSections["social_links"];
      const patch = (p: Partial<StorefrontSections["social_links"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show social links section" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} />
          <div className="flex flex-col gap-3">
            {s.items.map((item, i) => (
              <ListItemCard key={i} onRemove={() => patch({ items: s.items.filter((_, j) => j !== i) })}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Platform">
                    <Select
                      value={item.platform}
                      onValueChange={(platform) =>
                        patch({ items: s.items.map((it, j) => (j === i ? { ...it, platform: platform as SocialPlatform } : it)) })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_PLATFORMS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {SOCIAL_PLATFORM_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <TextField label="Display label" value={item.label} onChange={(label) => patch({ items: s.items.map((it, j) => (j === i ? { ...it, label } : it)) })} hint="Optional" />
                </div>
                <Field label="URL">
                  <Input
                    value={item.url}
                    placeholder="https://…"
                    onChange={(e) =>
                      patch({ items: s.items.map((it, j) => (j === i ? { ...it, url: e.target.value } : it)) })
                    }
                  />
                </Field>
              </ListItemCard>
            ))}
            <AddItemButton
              label="Add link"
              onClick={() => patch({ items: [...s.items, { platform: "website", url: "", label: "" }] })}
            />
          </div>
        </div>
      );
    }
    case "contact": {
      const s = section as StorefrontSections["contact"];
      const patch = (p: Partial<StorefrontSections["contact"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show contact section" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextField label="Heading" value={s.heading} onChange={(heading) => patch({ heading })} />
          <TextAreaField label="Body" value={s.body} onChange={(body) => patch({ body })} rows={2} />
          <TextField label="Contact email" value={s.email} onChange={(email) => patch({ email })} />
        </div>
      );
    }
    case "footer": {
      const s = section as StorefrontSections["footer"];
      const patch = (p: Partial<StorefrontSections["footer"]>) => onChange({ ...s, ...p });
      return (
        <div className="flex flex-col gap-4">
          <ToggleField label="Show footer" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
          <TextAreaField
            label="Footer text"
            value={s.text}
            onChange={(text) => patch({ text })}
            hint="Leave blank to show © year + brand name automatically."
          />
        </div>
      );
    }
    default:
      return <p className="text-sm text-zinc-400">{STOREFRONT_SECTION_LABELS[kind]}</p>;
  }
}

/* -------------------------------------------------------------------------- */

function VideoUrlField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const embeddable = toEmbedUrl(value);
  return (
    <Field label={label}>
      <Input
        value={value}
        placeholder="https://www.loom.com/share/…"
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        embeddable ? (
          <p className="text-xs text-emerald-600">Link recognized — it plays as an embedded video.</p>
        ) : (
          <p className="text-xs text-amber-600">
            Link not recognized — use a Loom, YouTube, or Vimeo URL.
          </p>
        )
      ) : (
        <p className="text-xs text-zinc-400">Paste a Loom, YouTube, or Vimeo link; it converts to an embed automatically.</p>
      )}
    </Field>
  );
}

function CtaEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Cta;
  onChange: (next: Cta) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Label" value={value.label} onChange={(l) => onChange({ ...value, label: l })} />
        <TextField label="Link" value={value.href} onChange={(h) => onChange({ ...value, href: h })} hint="Optional" />
      </div>
    </div>
  );
}

function AlignButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("flex-1", active && "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800")}
    >
      {children}
    </Button>
  );
}
