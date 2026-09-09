"use client";

import { createElement, useCallback, useMemo, useRef, useState } from "react";
import { Editor, Frame, Element as CraftElement, useEditor } from "@craftjs/core";
import { Block, BlockType, makeBlock } from "@/types/blocks";
import {
  CRAFT_RESOLVER,
  Container,
  CraftUi,
  CraftUiProvider,
  craftComponentForBlock,
  useCraftUi,
} from "@/components/landing/craft/elements";
import { BLOCK_CRAFT_NAME, craftPropsFromBlock, craftSerializedToBlocks } from "@/lib/craft";
import BlockEditor from "@/components/landing/BlockEditor";
import {
  Heading1,
  AlignLeft,
  Image as ImageIcon,
  MousePointerClick,
  Quote,
  HelpCircle,
  AtSign,
  MoveVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PALETTE: { type: BlockType; label: string; icon: React.ElementType }[] = [
  { type: "heading", label: "Heading", icon: Heading1 },
  { type: "text", label: "Text", icon: AlignLeft },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "cta_button", label: "Button", icon: MousePointerClick },
  { type: "signup_form", label: "Signup form", icon: AtSign },
  { type: "testimonial", label: "Testimonial", icon: Quote },
  { type: "faq", label: "FAQ", icon: HelpCircle },
  { type: "spacer", label: "Spacer", icon: MoveVertical },
];

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  cta_button: "Button",
  testimonial: "Testimonial",
  faq: "FAQ",
  signup_form: "Signup form",
  spacer: "Spacer",
};

export default function CraftPageEditor({
  seedBlocks,
  blocks,
  onChangeBlocks,
}: {
  /** Blocks captured once when the page loads — seeds the craft tree. */
  seedBlocks: Block[];
  /** Live blocks (kept in sync with the craft tree) — drives layers + saving. */
  blocks: Block[];
  onChangeBlocks: (next: Block[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mounted fresh per page (parent passes key={id}), so the emit guard seeds once.
  const lastEmitted = useRef<string>(JSON.stringify(seedBlocks));

  const ui = useMemo<CraftUi>(() => ({ selectedId, select: setSelectedId }), [selectedId]);

  const handleNodesChange = useCallback(
    (query: { getSerializedNodes(): unknown }) => {
      const raw = query.getSerializedNodes() as Parameters<typeof craftSerializedToBlocks>[0];
      const next = craftSerializedToBlocks(raw);
      const key = JSON.stringify(next);
      if (key !== lastEmitted.current) {
        lastEmitted.current = key;
        onChangeBlocks(next);
      }
    },
    [onChangeBlocks]
  );

  return (
    <CraftUiProvider value={ui}>
      <Editor resolver={CRAFT_RESOLVER as Record<string, React.ElementType>} onNodesChange={handleNodesChange}>
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {/* Toolbox + layers + properties */}
          <aside className="w-full lg:w-[300px] shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-zinc-200 bg-zinc-50/40">
            <Toolbox />
            <LayersPanel blocks={blocks} />
            <PropertiesPanel blocks={blocks} />
          </aside>

          {/* Canvas */}
          <div className="flex-1 min-w-0 bg-zinc-100/80 overflow-y-auto">
            <div className="m-6 mx-auto max-w-4xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <Frame>
                <CraftElement is={Container} canvas>
                  {seedBlocks.map((block) => {
                    const Component = craftComponentForBlock(block);
                    return (
                      <CraftElement
                        key={block.id}
                        is={Component}
                        id={block.id}
                        {...craftPropsFromBlock(block)}
                      />
                    );
                  })}
                </CraftElement>
              </Frame>
            </div>
            {blocks.length === 0 ? (
              <p className="pb-6 text-center text-xs text-zinc-400">
                Page is empty — add a block from the left panel.
              </p>
            ) : null}
          </div>
        </div>
      </Editor>
    </CraftUiProvider>
  );
}

/* -------------------------------------------------------------------------- */

function Toolbox() {
  const editor = useEditor();

  function addBlock(type: BlockType) {
    const props = craftPropsFromBlock(makeBlock(type));
    const name = BLOCK_CRAFT_NAME[type];
    const Comp = (CRAFT_RESOLVER as Record<string, React.ComponentType<Record<string, unknown>>>)[name];
    const tree = editor.query.parseReactElement(createElement(Comp, props)).toNodeTree();
    const count = (editor.query.getSerializedNodes().ROOT as { nodes?: string[] } | undefined)?.nodes?.length ?? 0;
    editor.actions.addNodeTree(tree, "ROOT", count);
  }

  return (
    <section className="border-b border-zinc-200 p-4 flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Add block</p>
      <div className="grid grid-cols-4 gap-2">
        {PALETTE.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className="flex flex-col items-center gap-1 rounded-md border border-zinc-200 bg-white py-2.5 text-[11px] font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
          >
            <Icon className="h-4 w-4 text-zinc-400" />
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        Drag a block&rsquo;s ≡ handle to reorder it on the canvas, or use the arrows.
      </p>
    </section>
  );
}

function LayersPanel({ blocks }: { blocks: Block[] }) {
  const { selectedId, select } = useCraftUi();
  const editor = useEditor();

  function move(id: string, dir: -1 | 1) {
    const list = (editor.query.getSerializedNodes().ROOT as { nodes?: string[] } | undefined)?.nodes ?? [];
    const index = list.indexOf(id);
    const target = index + dir;
    if (index === -1 || target < 0 || target >= list.length) return;
    editor.actions.move(id, "ROOT", target);
  }

  return (
    <section className="border-b border-zinc-200 p-4 flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5" /> Page blocks · {blocks.length}
      </p>
      {blocks.length === 0 ? (
        <p className="text-xs text-zinc-400">No blocks yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {blocks.map((block, index) => (
            <li
              key={block.id}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm cursor-pointer",
                selectedId === block.id
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              )}
              onClick={() => select(selectedId === block.id ? null : block.id)}
            >
              <span className="text-xs text-zinc-400 w-5 shrink-0">{index + 1}.</span>
              <span className="truncate flex-1">{BLOCK_LABELS[block.type]}</span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 hover:bg-zinc-200 disabled:opacity-30"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  move(block.id, -1);
                }}
                aria-label="Move up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 hover:bg-zinc-200 disabled:opacity-30"
                disabled={index === blocks.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  move(block.id, 1);
                }}
                aria-label="Move down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 hover:bg-red-100 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.actions.delete(block.id);
                  select(null);
                }}
                aria-label={`Delete ${BLOCK_LABELS[block.type]}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PropertiesPanel({ blocks }: { blocks: Block[] }) {
  const { selectedId } = useCraftUi();
  const editor = useEditor();
  const block = blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <section className="p-4 flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {block ? `Edit · ${BLOCK_LABELS[block.type]}` : "Edit"}
      </p>
      {!selectedId || !block ? (
        <p className="text-xs text-zinc-400 leading-relaxed">
          Click a block on the canvas to edit its content here.
        </p>
      ) : (
        <BlockEditor
          block={block}
          onChange={(next) => {
            editor.actions.setProp(selectedId, () => craftPropsFromBlock(next));
          }}
        />
      )}
    </section>
  );
}
