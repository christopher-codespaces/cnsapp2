"use client";

import { createContext, useContext } from "react";
import { useEditor, useNode } from "@craftjs/core";
import {
  Block,
  BlockType,
  HeadingBlock,
  TextBlock,
  ImageBlock,
  CtaBlock,
  TestimonialBlock,
  FaqBlock,
  SignupFormBlock,
  normalizeBlock,
} from "@/types/blocks";
import {
  HeadingView,
  TextView,
  ImageView,
  CtaView,
  TestimonialView,
  FaqBlockView,
  SignupView,
} from "@/components/landing/LpRenderer";
import { BLOCK_CRAFT_NAME, craftPropsFromBlock } from "@/lib/craft";
import { GripVertical, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** UI coordination passed down to every canvas element. */
export interface CraftUi {
  selectedId: string | null;
  select: (id: string | null) => void;
}

const CraftUiContext = createContext<CraftUi | null>(null);
export const CraftUiProvider = CraftUiContext.Provider;
export function useCraftUi(): CraftUi {
  const ui = useContext(CraftUiContext);
  if (!ui) return { selectedId: null, select: () => {} };
  return ui;
}

function blockFromProps(type: BlockType, props: Record<string, unknown>): Block | null {
  return normalizeBlock({ id: "", type, ...props });
}

function renderBlockBody(block: Block | null) {
  if (!block) return null;
  switch (block.type) {
    case "heading":
      return <HeadingView block={block as HeadingBlock} />;
    case "text":
      return <TextView block={block as TextBlock} />;
    case "image":
      return <ImageView block={block as ImageBlock} />;
    case "cta_button":
      return <CtaView block={block as CtaBlock} />;
    case "testimonial":
      return <TestimonialView block={block as TestimonialBlock} />;
    case "faq":
      return <FaqBlockView block={block as FaqBlock} />;
    case "signup_form":
      return <SignupView block={block as SignupFormBlock} creatorId={null} sourceId={null} />;
    case "spacer":
      return <div style={{ height: block.height }} aria-hidden />;
    default:
      return null;
  }
}

/** Chrome wrapper around every draggable canvas block (editor only). */
function BlockFrame({ label, block }: { label: string; block: Block | null }) {
  const { id, connectors } = useNode();
  const ui = useCraftUi();
  const editor = useEditor();
  const selected = ui.selectedId === id;

  function move(dir: -1 | 1) {
    const nodes = editor.query.getSerializedNodes();
    const rootNodes = nodes.ROOT?.nodes ?? [];
    const index = rootNodes.indexOf(id);
    const target = index + dir;
    if (index === -1 || target < 0 || target >= rootNodes.length) return;
    editor.actions.move(id, "ROOT", target);
  }

  function remove() {
    editor.actions.delete(id);
    ui.select(null);
  }

  return (
    <div
      onClickCapture={(e) => {
        e.preventDefault();
        ui.select(id);
      }}
      className={cn(
        "group relative my-1 cursor-pointer",
        selected && "outline outline-2 outline-zinc-800 rounded-md"
      )}
    >
      {/* Toolbar — visible on hover/selection */}
      <div
        className={cn(
          "pointer-events-none absolute -top-0 right-1 z-10 flex items-center gap-0.5 transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <span className="inline-flex items-center gap-1 rounded-t-md bg-zinc-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {label}
        </span>
        <button
          type="button"
          title="Drag to reorder"
          ref={(ref) => {
            if (ref) connectors.drag(ref);
          }}
          className="pointer-events-auto rounded bg-zinc-200 p-1 text-zinc-600 hover:bg-zinc-300 cursor-grab"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
          <span className="sr-only">Drag to reorder</span>
        </button>
        <button
          type="button"
          title="Move up"
          onClick={(e) => {
            e.stopPropagation();
            move(-1);
          }}
          className="pointer-events-auto rounded bg-zinc-200 p-1 text-zinc-600 hover:bg-zinc-300"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          <span className="sr-only">Move up</span>
        </button>
        <button
          type="button"
          title="Move down"
          onClick={(e) => {
            e.stopPropagation();
            move(1);
          }}
          className="pointer-events-auto rounded bg-zinc-200 p-1 text-zinc-600 hover:bg-zinc-300"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          <span className="sr-only">Move down</span>
        </button>
        <button
          type="button"
          title="Delete block"
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
          className="pointer-events-auto rounded bg-zinc-200 p-1 text-zinc-600 hover:bg-red-600 hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Delete block</span>
        </button>
      </div>
      {block ? renderBlockBody(block) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Craft user components                                                       */
/* -------------------------------------------------------------------------- */

/** Root canvas: holds the vertically-ordered blocks. */
export const Container = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="mx-auto w-full max-w-3xl min-h-[60vh] px-6 py-8 sm:py-12">
      {children}
    </div>
  );
};
(Container as unknown as { craft?: unknown }).craft = {
  displayName: "Container",
  canvas: true,
  props: {},
};

function makeCraftComponent(type: BlockType, label: string, defaults: Record<string, unknown>) {
  const Component = (props: Record<string, unknown>) => {
    const block = blockFromProps(type, props);
    return <BlockFrame label={label} block={block} />;
  };
  (Component as unknown as { craft?: unknown }).craft = {
    displayName: BLOCK_CRAFT_NAME[type],
    props: defaults,
  };
  return Component;
}

// Default props mirror makeBlock() output (minus id) so palette drops work.
const HEADING = makeCraftComponent("heading", "Heading", { text: "New heading", level: 2, align: "left" });
const TEXT = makeCraftComponent("text", "Text", { body: "", align: "left" });
const IMAGE = makeCraftComponent("image", "Image", { url: "", alt: "", caption: "" });
const CTA = makeCraftComponent("cta_button", "Button", { label: "Get started", href: "", align: "left" });
const TESTIMONIAL = makeCraftComponent("testimonial", "Testimonial", { quote: "", author: "", role: "" });
const FAQ = makeCraftComponent("faq", "FAQ", { heading: "", items: [] });
const SIGNUP = makeCraftComponent("signup_form", "Signup form", {
  heading: "",
  body: "",
  cta_label: "Subscribe",
  align: "center",
});
const SPACER = makeCraftComponent("spacer", "Spacer", { height: 48 });

export const CRAFT_RESOLVER = {
  Container,
  Heading: HEADING,
  Text: TEXT,
  Image: IMAGE,
  CtaButton: CTA,
  Testimonial: TESTIMONIAL,
  Faq: FAQ,
  SignupForm: SIGNUP,
  Spacer: SPACER,
} as const;

export function craftComponentForBlock(block: Block) {
  const name = BLOCK_CRAFT_NAME[block.type];
  return (CRAFT_RESOLVER as Record<string, React.ComponentType<Record<string, unknown>>>)[name];
}

export { craftPropsFromBlock };
