import { useEffect } from 'react';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { DEFAULT_LOGO_URL, DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL, SITE_BASE_URL as SITE_URL, socialImageUrl, toAbsoluteSiteUrl } from '@/lib/siteAssets';

interface SeoHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
  ogType?: 'website' | 'article' | 'profile';
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleAuthor?: string;
}

export function useSeoHead({ title, description, canonical, ogImage, noindex, ogType, articlePublishedTime, articleModifiedTime, articleAuthor }: SeoHeadProps) {
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

    const resolvedOgImage = socialImageUrl(ogImage);
    const resolvedLogo = toAbsoluteSiteUrl(DEFAULT_LOGO_URL);

    const setSocialImageMeta = (content: string) => {
      setMeta('og:image', content, 'property');
      setMeta('og:image:secure_url', content, 'property');
      setMeta('twitter:image', content);
    };

    // Open Graph
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', ogType || 'website', 'property');
    setSocialImageMeta(resolvedOgImage);
    setMeta('og:site_name', 'Preciso de um', 'property');
    setMeta('og:locale', 'pt_BR', 'property');
    setMeta('logo', resolvedLogo, 'property');

    // Article-specific OG tags
    if (ogType === 'article') {
      if (articlePublishedTime) setMeta('article:published_time', articlePublishedTime, 'property');
      if (articleModifiedTime) setMeta('article:modified_time', articleModifiedTime, 'property');
      if (articleAuthor) setMeta('article:author', articleAuthor, 'property');
    }

    // Twitter
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);

    let cancelled = false;
    const imageProbe = new Image();
    imageProbe.onload = () => {
      if (!cancelled) setSocialImageMeta(resolvedOgImage);
    };
    imageProbe.onerror = () => {
      if (!cancelled) setSocialImageMeta(DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL);
    };
    imageProbe.src = resolvedOgImage || DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL;

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
      cancelled = true;
      imageProbe.onload = null;
      imageProbe.onerror = null;
      document.title = 'Preciso de um | Encontre um profissional para qualquer tipo de serviço no Brasil';
    };
  }, [title, description, canonical, ogImage, noindex, gscId, gaId, ogType, articlePublishedTime, articleModifiedTime, articleAuthor]);
}

export const SITE_BASE_URL = SITE_URL;
