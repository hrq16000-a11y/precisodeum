/**
 * Returns the internal route for a sponsor's public page if a slug exists.
 * Banners use this to link the sponsor name/logo to /patrocinador/{slug}.
 * The CTA button continues to point to the external link (website/WhatsApp).
 */
export function sponsorInternalHref(slug?: string | null): string | null {
  if (!slug) return null;
  const s = String(slug).trim();
  if (!s) return null;
  return `/patrocinador/${s}`;
}
