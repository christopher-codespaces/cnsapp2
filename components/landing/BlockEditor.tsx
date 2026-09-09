"use client";

import {
  Block,
  HeadingBlock,
  TextBlock,
  ImageBlock,
  CtaBlock,
  TestimonialBlock,
  FaqBlock,
  SignupFormBlock,
  SpacerBlock,
  TextAlign,
} from "@/types/blocks";
import {
  Field,
  TextField,
  TextAreaField,
  ListItemCard,
  AddItemButton,
} from "@/components/builder/fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlignCenter, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline editor for one block. `onChange` gets the next full block object. */
export default function BlockEditor({
  block,
  onChange,
}: {
  block: Block;
  onChange: (next: Block) => void;
}) {
  switch (block.type) {
    case "heading":
      return <HeadingEditor block={block} onChange={onChange} />;
    case "text":
      return <TextEditor block={block} onChange={onChange} />;
    case "image":
      return <ImageEditor block={block} onChange={onChange} />;
    case "cta_button":
      return <CtaEditor block={block} onChange={onChange} />;
    case "testimonial":
      return <TestimonialEditor block={block} onChange={onChange} />;
    case "faq":
      return <FaqEditor block={block} onChange={onChange} />;
    case "signup_form":
      return <SignupEditor block={block} onChange={onChange} />;
    case "spacer":
      return <SpacerEditor block={block} onChange={onChange} />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */

function AlignToggle({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (next: TextAlign) => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange("left")}
        className={cn("flex-1", value === "left" && "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800")}
      >
        <AlignLeft className="h-4 w-4" /> Left
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange("center")}
        className={cn("flex-1", value === "center" && "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800")}
      >
        <AlignCenter className="h-4 w-4" /> Center
      </Button>
    </div>
  );
}

function HeadingEditor({
  block,
  onChange,
}: {
  block: HeadingBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Text" value={block.text} onChange={(text) => onChange({ ...block, text })} />
      <Field label="Size">
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((level) => (
            <Button
              key={level}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...block, level })}
              className={cn("flex-1", block.level === level && "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800")}
            >
              {level === 1 ? "H1" : level === 2 ? "H2" : "H3"}
            </Button>
          ))}
        </div>
      </Field>
      <Field label="Alignment">
        <AlignToggle value={block.align} onChange={(align) => onChange({ ...block, align })} />
      </Field>
    </div>
  );
}

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (next: Block) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TextAreaField label="Text" rows={5} value={block.body} onChange={(body) => onChange({ ...block, body })} />
      <Field label="Alignment">
        <AlignToggle value={block.align} onChange={(align) => onChange({ ...block, align })} />
      </Field>
    </div>
  );
}

function ImageEditor({ block, onChange }: { block: ImageBlock; onChange: (next: Block) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Image URL" value={block.url} onChange={(url) => onChange({ ...block, url })} placeholder="https://…" />
      <TextField label="Alt text" value={block.alt} onChange={(alt) => onChange({ ...block, alt })} hint="Optional" />
      <TextField label="Caption" value={block.caption} onChange={(caption) => onChange({ ...block, caption })} hint="Optional" />
    </div>
  );
}

function CtaEditor({ block, onChange }: { block: CtaBlock; onChange: (next: Block) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Button label" value={block.label} onChange={(label) => onChange({ ...block, label })} />
      <TextField label="Link" value={block.href} onChange={(href) => onChange({ ...block, href })} hint="Optional — leave blank for a non-linking button." />
      <Field label="Alignment">
        <AlignToggle value={block.align} onChange={(align) => onChange({ ...block, align })} />
      </Field>
    </div>
  );
}

function TestimonialEditor({
  block,
  onChange,
}: {
  block: TestimonialBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <TextAreaField label="Quote" rows={3} value={block.quote} onChange={(quote) => onChange({ ...block, quote })} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Author" value={block.author} onChange={(author) => onChange({ ...block, author })} hint="Optional" />
        <TextField label="Role" value={block.role} onChange={(role) => onChange({ ...block, role })} hint="Optional" />
      </div>
    </div>
  );
}

function FaqEditor({ block, onChange }: { block: FaqBlock; onChange: (next: Block) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Heading" value={block.heading} onChange={(heading) => onChange({ ...block, heading })} hint="Optional" />
      <div className="flex flex-col gap-3">
        {block.items.map((item, i) => (
          <ListItemCard key={i} onRemove={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
            <TextField label="Question" value={item.q} onChange={(q) => onChange({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, q } : it)) })} />
            <TextAreaField label="Answer" rows={2} value={item.a} onChange={(a) => onChange({ ...block, items: block.items.map((it, j) => (j === i ? { ...it, a } : it)) })} />
          </ListItemCard>
        ))}
        <AddItemButton label="Add question" onClick={() => onChange({ ...block, items: [...block.items, { q: "", a: "" }] })} />
      </div>
    </div>
  );
}

function SignupEditor({
  block,
  onChange,
}: {
  block: SignupFormBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Heading" value={block.heading} onChange={(heading) => onChange({ ...block, heading })} />
      <TextAreaField label="Body" rows={2} value={block.body} onChange={(body) => onChange({ ...block, body })} />
      <TextField label="Button label" value={block.cta_label} onChange={(cta_label) => onChange({ ...block, cta_label })} />
      <Field label="Alignment">
        <AlignToggle value={block.align} onChange={(align) => onChange({ ...block, align })} />
      </Field>
    </div>
  );
}

function SpacerEditor({ block, onChange }: { block: SpacerBlock; onChange: (next: Block) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label={`Spacing — ${block.height}px`}>
        <Input
          type="range"
          min={8}
          max={320}
          step={8}
          value={block.height}
          onChange={(e) => onChange({ ...block, height: Number(e.target.value) })}
        />
      </Field>
    </div>
  );
}
