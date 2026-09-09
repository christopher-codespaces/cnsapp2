import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LpRenderer from "@/components/landing/LpRenderer";
import { normalizeLandingContent } from "@/types/blocks";

export const dynamic = "force-dynamic";

interface PublicProfile {
  id: string;
  handle: string;
  brand_name: string;
  logo_url: string | null;
}

/**
 * Public landing page. Resolves handle through the public_creator_profiles
 * view, then reads the published landing page by slug for that creator.
 * 404s when either the handle is unknown or the page isn't published.
 */
export default async function LandingPagePublicRoute({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = await params;

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
    console.error("public landing page profile lookup failed:", profileError);
  }
  if (!profile) notFound();

  const { data: page, error: pageError } = await (supabase
    .from("landing_pages")
    .select("id, content")
    .eq("creator_id", profile.id)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle() as unknown as Promise<{
    data: { id: string; content: unknown } | null;
    error: { message: string } | null;
  }>);
  if (pageError) {
    console.error("public landing page lookup failed:", pageError);
  }
  if (!page) notFound();

  const content = normalizeLandingContent(page.content);

  return (
    <main className="min-h-screen bg-white">
      <LpRenderer
        content={content}
        brandName={profile.brand_name}
        logoUrl={profile.logo_url}
        creatorId={profile.id}
        sourceId={page.id}
      />
    </main>
  );
}
