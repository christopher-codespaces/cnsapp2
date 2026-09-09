export type CatalogKind = "product" | "course";

export type ProductType =
  | "pdf"
  | "ebook"
  | "template"
  | "canva"
  | "notion"
  | "zip"
  | "audio"
  | "membership";

export const PRODUCT_TYPES: ProductType[] = [
  "pdf",
  "ebook",
  "template",
  "canva",
  "notion",
  "zip",
  "audio",
  "membership",
];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  pdf: "PDF",
  ebook: "Ebook",
  template: "Template",
  canva: "Canva",
  notion: "Notion",
  zip: "Digital bundle",
  audio: "Audio",
  membership: "Membership",
};

/** List-row shape shared by both catalog pages. */
export interface CatalogListRow {
  id: string;
  title: string;
  price_cents: number;
  is_published: boolean;
  updated_at: string;
  type?: ProductType; // products only
}
