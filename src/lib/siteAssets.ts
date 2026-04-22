export const SITE_BASE_URL = 'https://precisodeum.com.br';

export const DEFAULT_LOGO_URL = '/lovable-uploads/8a22c45f-f2c2-4ac8-a925-92aecd2b313b.png';
export const DEFAULT_FOOTER_LOGO_URL = DEFAULT_LOGO_URL;
export const DEFAULT_SOCIAL_IMAGE_URL = '/social-image.png';

export const toAbsoluteSiteUrl = (url: string | null | undefined): string => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${SITE_BASE_URL}${value}`;
  return `${SITE_BASE_URL}/${value}`;
};

export const siteImageOrFallback = (url: string | null | undefined, fallback: string): string => {
  const value = String(url || '').trim();
  return value || fallback;
};

export const socialImageUrl = (url?: string | null): string => {
  return toAbsoluteSiteUrl(url || DEFAULT_SOCIAL_IMAGE_URL);
};