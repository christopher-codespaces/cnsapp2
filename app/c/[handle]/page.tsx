import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StorefrontRenderer from "@/components/storefront/StorefrontRenderer";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import { CatalogItem, normalizeStorefrontSections } from "@/types/blocks";

export const dynamic = "force-dynamic";

interface PublicProfile {
  id: string;
  handle: string;
  brand_name: string;
  logo_url: string | null;
}

/**
 * Public storefront page. Reads branding through the curated
 * public_creator_profiles view (the creators table is RLS-private) and the
 * creator's storefront through the "published readable by anyone" policy.
 * 404s when the handle is unknown or the storefront isn't published.
 */
export default async function StorefrontPublicPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const supabase = await createClient();

  const { data: profile, error: profileError } = await (supabase
    .from("public_creator_profiles")
    .select("id, handle, brand_name, logo_url")
    .eq("handle", handle)
    .maybeSingle() as unknown as Promise<{
    data: PublicProfile | null;
    error: { message: string } | null;
  }>);
  if (profileError) {
    console.error("public storefront profile lookup failed:", profileError);
  }
  if (!profile) notFound();

  const { data: storefront, error: storefrontError } = await (supabase
    .from("storefronts")
    .select("sections")
    .eq("creator_id", profile.id)
    .eq("is_published", true)
    .maybeSingle() as unknown as Promise<{
    data: { sections: unknown } | null;
    error: { message: string } | null;
  }>);
  if (storefrontError) {
    console.error("public storefront lookup failed:", storefrontError);
  }
  if (!storefront) notFound();

  const sections = normalizeStorefrontSections(storefront.sections);

  // Published products/courses render as cards in the matching sections.
  // (Anon read is granted by the Phase 3 migration; until it's applied these
  // resolve to RLS-visible published rows only after the policy exists.)
  const [prodRes, courseRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, title, description, price_cents, cover_image_url")
      .eq("creator_id", profile.id)
      .eq("is_published", true),
    supabase
      .from("courses")
      .select("id, title, description, price_cents, cover_image_url")
      .eq("creator_id", profile.id)
      .eq("is_published", true),
  ]);
  const products = (prodRes.data ?? []) as unknown as CatalogItem[];
  const courses = (courseRes.data ?? []) as unknown as CatalogItem[];

  return (
    <main className="min-h-screen bg-white">
      <PageViewTracker creatorId={profile.id} />
      <StorefrontRenderer
        sections={sections}
        brandName={profile.brand_name}
        logoUrl={profile.logo_url}
        creatorId={profile.id}
        products={products}
        courses={courses}
      />
    </main>
  );
}
