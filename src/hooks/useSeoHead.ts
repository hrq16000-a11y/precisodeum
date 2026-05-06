import { useEffect } from 'react';
import { useSettingValue } from '@/hooks/useSiteSettings';

const SITE_URL = 'https://precisodeum.com.br';
const DEFAULT_OG_IMAGE = 'https://storage.googleapis.com/gpt-engineer-file-uploads/El3gITL9bldQ7WZaPszZm8jw8DX2/social-images/social-1773355301217-69324.webp';

interface SeoHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

export function useSeoHead({ title, description, canonical, ogImage, noindex }: SeoHeadProps) {
  const gscId = useSettingValue('google_search_console_id');
  const gaId = useSettingValue('google_analytics_id');

  useEffect(() => {
    const fullTitle = title.includes('Preciso de um') ? title : `${title} | Preciso de um`;
    document.title = fullTitle;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Basic meta
    setMeta('description', description);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Open Graph
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:image', ogImage || DEFAULT_OG_IMAGE, 'property');
    setMeta('og:site_name', 'Preciso de um', 'property');

    // Twitter
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage || DEFAULT_OG_IMAGE);

    // Google Search Console verification
    if (gscId) {
      setMeta('google-site-verification', gscId);
    }

    // Canonical & og:url
    const canonicalUrl = canonical || `${SITE_URL}${window.location.pathname}`;
    setMeta('og:url', canonicalUrl, 'property');

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalUrl);

    return () => {
      document.title = 'Preciso de um | Encontre profissionais confiáveis perto de você';
    };
  }, [title, description, canonical, ogImage, noindex, gscId, gaId]);
}

export const SITE_BASE_URL = SITE_URL;
