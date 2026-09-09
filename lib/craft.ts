// =============================================================================
// Craft.js <-> canonical Block[] converters
// -----------------------------------------------------------------------------
// The Landing Page editor is built on @craftjs/core (drag & drop canvas), but
// persistence keeps using the documented, AI-friendly jsonb contract from
// types/blocks.ts ({ blocks: Block[] }). These converters bridge the two:
//   * blocks -> craft serialized nodes  (seeding the editor once on open)
//   * craft serialized nodes -> blocks  (every change, then saved as before)
// Public pages and the Phase 4/5 AI actions continue to use Block[] only.
// =============================================================================

import {
  Block,
  BlockType,
  normalizeBlock,
} from "@/types/blocks";

export const CRAFT_ROOT_ID = "ROOT";

/** resolvedName used in the craft node tree for each block type. */
export const BLOCK_CRAFT_NAME: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  cta_button: "CtaButton",
  testimonial: "Testimonial",
  faq: "Faq",
  signup_form: "SignupForm",
  spacer: "Spacer",
};

const CRAFT_TO_TYPE: Record<string, BlockType> = Object.fromEntries(
  Object.entries(BLOCK_CRAFT_NAME).map(([type, name]) => [name, type as BlockType])
) as Record<string, BlockType>;

export function blockTypeFromCraftName(name: unknown): BlockType | null {
  if (typeof name !== "string") return null;
  return CRAFT_TO_TYPE[name] ?? null;
}

export interface CraftNodeJson {
  type: { resolvedName: string };
  nodes: string[];
  props: Record<string, unknown>;
  custom: Record<string, unknown>;
  hidden: boolean;
  parent?: string | null;
  displayName?: string;
  linkedNodes?: Record<string, string>;
}

export type CraftSerializedNodes = Record<string, CraftNodeJson>;

/** The plain prop keys craft stores for a given block (no id/type). */
export function craftPropsFromBlock(block: Block): Record<string, unknown> {
  switch (block.type) {
    case "heading":
      return { text: block.text, level: block.level, align: block.align };
    case "text":
      return { body: block.body, align: block.align };
    case "image":
      return { url: block.url, alt: block.alt, caption: block.caption };
    case "cta_button":
      return { label: block.label, href: block.href, align: block.align };
    case "testimonial":
      return { quote: block.quote, author: block.author, role: block.role };
    case "faq":
      return { heading: block.heading, items: block.items };
    case "signup_form":
      return { heading: block.heading, body: block.body, cta_label: block.cta_label, align: block.align };
    case "spacer":
      return { height: block.height };
  }
}

/** Build a craft serialized node tree from canonical blocks. */
export function blocksToCraftSerialized(blocks: Block[]): CraftSerializedNodes {
  const ids = blocks.map((b) => b.id);
  const nodes: CraftSerializedNodes = {
    [CRAFT_ROOT_ID]: {
      type: { resolvedName: "Container" },
      nodes: ids,
      props: {},
      custom: {},
      hidden: false,
      displayName: "Page",
      linkedNodes: {},
    },
  };
  for (const block of blocks) {
    nodes[block.id] = {
      type: { resolvedName: BLOCK_CRAFT_NAME[block.type] },
      nodes: [],
      props: craftPropsFromBlock(block),
      custom: {},
      hidden: false,
      parent: CRAFT_ROOT_ID,
      displayName: BLOCK_CRAFT_NAME[block.type],
      linkedNodes: {},
    };
  }
  return nodes;
}

/** Convert craft serialized nodes (in ROOT child order) back to Block[]. */
export function craftSerializedToBlocks(
  serialized: CraftSerializedNodes | null | undefined
): Block[] {
  const root = serialized?.[CRAFT_ROOT_ID];
  if (!root || !Array.isArray(root.nodes)) return [];
  const out: Block[] = [];
  for (const id of root.nodes) {
    const node = serialized?.[id];
    if (!node) continue;
    const type = blockTypeFromCraftName(node.type?.resolvedName);
    if (!type) continue;
    const block = normalizeBlock({ id, type, ...(node.props ?? {}) });
    if (block) out.push(block);
  }
  return out;
}
