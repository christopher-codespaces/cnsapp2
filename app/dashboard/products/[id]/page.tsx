"use client";

import { useParams } from "next/navigation";
import CatalogEditor from "@/components/catalog/CatalogEditor";

export default function ProductEditorPage() {
  const params = useParams<{ id: string }>();
  return <CatalogEditor kind="product" id={params.id} />;
}
