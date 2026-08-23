import { useEffect } from 'react';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { DEFAULT_LOGO_URL, DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL, SITE_BASE_URL as SITE_URL, socialImageUrl, toAbsoluteSiteUrl } from '@/lib/siteAssets';
import { buildCanonicalUrl } from '@/lib/canonicalUrl';
import { normalizeSocialImageUrl } from '@/lib/imageUrlNormalizer';
import { seoFallbackFromPath } from '@/lib/seoUrlFallback';
import { resolveSocialImage, seoDebugLog, toSocialImageCandidates } from '@/lib/socialImageFallback';

interface SeoHeadProps {
  title: string;
  description: string;
  canonical?: string;
  /** URL única ou lista de candidatos — a primeira válida é usada. */
  ogImage?: string | string[];
  noindex?: boolean;
  ogType?: 'website' | 'article' | 'profile';
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleAuthor?: string;
  /** URL absoluta da página anterior em listagens paginadas (rel="prev"). */
  prevUrl?: string;
  /** URL absoluta da próxima página em listagens paginadas (rel="next"). */
  nextUrl?: string;
}

export function useSeoHead({ title, description, canonical, ogImage, noindex, ogType, articlePublishedTime, articleModifiedTime, articleAuthor, prevUrl, nextUrl }: SeoHeadProps) {
  const gscId = useSettingValue('google_search_console_id');
  const gaId = useSettingValue('google_analytics_id');

  useEffect(() => {
    // Resiliência: se title/description vierem vazios (ex.: query ainda
    // carregando ou falhou), derivamos do pathname para nunca deixar
    // metadados em branco para o crawler.
    const fb = seoFallbackFromPath(typeof window !== 'undefined' ? window.location.pathname : '/');
    const titleOk = !!(title && title.trim().length >= 3);
    // Limite reduzido (30 → 10) para não substituir descrições curtas mas válidas
    // (ex.: meta de perfis enxutos). Fallback só entra em string realmente vazia/lixo.
    const descOk = !!(description && description.trim().length >= 10);
    const safeTitle = titleOk ? title : fb.title;
    const safeDescription = descOk ? description : fb.description;
    const safeOgType = ogType || fb.ogType;

    if (import.meta.env?.DEV && (!titleOk || !descOk)) {
      // eslint-disable-next-line no-console
      console.warn('[useSeoHead] Fallback de URL aplicado', {
        path: typeof window !== 'undefined' ? window.location.pathname : '/',
        usedTitleFallback: !titleOk,
        usedDescriptionFallback: !descOk,
        receivedTitle: title,
        receivedDescription: description,
      });
    }

    const fullTitle = safeTitle.includes('Preciso de um') ? safeTitle : `${safeTitle} | Preciso de um`;
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
    setMeta('description', safeDescription);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    const resolvedOgImage = normalizeSocialImageUrl(ogImage || socialImageUrl(ogImage), 'og:image');
    const resolvedLogo = toAbsoluteSiteUrl(DEFAULT_LOGO_URL);

    const setSocialImageMeta = (content: string) => {
      setMeta('og:image', content, 'property');
      setMeta('og:image:secure_url', content, 'property');
      setMeta('og:image:type', content.toLowerCase().endsWith('.jpg') || content.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png', 'property');
      setMeta('og:image:width', '1200', 'property');
      setMeta('og:image:height', '630', 'property');
      setMeta('og:image:alt', `${safeTitle} — Preciso de um`, 'property');
      setMeta('twitter:image', content);
      setMeta('twitter:image:alt', `${safeTitle} — Preciso de um`);
    };

    // Open Graph
    setMeta('og:title', fullTitle, 'property');
    setMeta('og:description', safeDescription, 'property');
    setMeta('og:type', safeOgType, 'property');
    setSocialImageMeta(resolvedOgImage);
    setMeta('og:site_name', 'Preciso de um', 'property');
    setMeta('og:locale', 'pt_BR', 'property');
    setMeta('logo', resolvedLogo, 'property');

    // Article-specific OG tags
    if (safeOgType === 'article') {
      if (articlePublishedTime) setMeta('article:published_time', articlePublishedTime, 'property');
      if (articleModifiedTime) setMeta('article:modified_time', articleModifiedTime, 'property');
      if (articleAuthor) setMeta('article:author', articleAuthor, 'property');
    }

    // Twitter
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', safeDescription);

    let cancelled = false;
    let imageProbe: HTMLImageElement | null = null;
    const headController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const headTimeout = window.setTimeout(() => headController?.abort(), 1200);

    const validateWithImageProbe = () => {
      if (cancelled) return;
      imageProbe = new Image();
      imageProbe.onload = () => {
        if (!cancelled) setSocialImageMeta(resolvedOgImage);
      };
      imageProbe.onerror = () => {
        if (!cancelled) setSocialImageMeta(DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL);
      };
      imageProbe.src = resolvedOgImage || DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL;
    };

    const validateSocialImage = async () => {
      if (!resolvedOgImage || resolvedOgImage === DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL) return;

      if (typeof fetch !== 'function' || !headController) {
        validateWithImageProbe();
        return;
      }

      try {
        const response = await fetch(resolvedOgImage, {
          method: 'HEAD',
          cache: 'force-cache',
          signal: headController.signal,
        });

        if (cancelled) return;
        if (response.status === 403 || response.status === 404 || !response.ok) {
          setSocialImageMeta(DEFAULT_SOCIAL_IMAGE_ABSOLUTE_URL);
          return;
        }

        setSocialImageMeta(resolvedOgImage);
      } catch {
        validateWithImageProbe();
      } finally {
        window.clearTimeout(headTimeout);
      }
    };

    void validateSocialImage();

    // Google Search Console verification
    if (gscId) {
      setMeta('google-site-verification', gscId);
    }

    // Canonical & og:url — sempre via helper compartilhado (absoluto e normalizado).
    const canonicalUrl = buildCanonicalUrl(canonical || window.location.pathname);
    setMeta('og:url', canonicalUrl, 'property');

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalUrl);

    // rel=prev / rel=next para paginação (Google usa como dica + Bing/outros)
    const setOrRemoveRel = (rel: 'prev' | 'next', href: string | undefined) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (href) {
        if (!el) {
          el = document.createElement('link');
          el.setAttribute('rel', rel);
          document.head.appendChild(el);
        }
        el.setAttribute('href', href);
      } else if (el) {
        el.parentNode?.removeChild(el);
      }
    };
    setOrRemoveRel('prev', prevUrl);
    setOrRemoveRel('next', nextUrl);

    return () => {
      cancelled = true;
      headController?.abort();
      window.clearTimeout(headTimeout);
      if (imageProbe) {
        imageProbe.onload = null;
        imageProbe.onerror = null;
      }
      // Limpa rel=prev/next ao desmontar (outras rotas não devem herdar).
      document.querySelector('link[rel="prev"]')?.remove();
      document.querySelector('link[rel="next"]')?.remove();
      document.title = 'Preciso de um | Encontre um profissional para qualquer tipo de serviço no Brasil';
    };
  }, [title, description, canonical, ogImage, noindex, gscId, gaId, ogType, articlePublishedTime, articleModifiedTime, articleAuthor, prevUrl, nextUrl]);
}

export const SITE_BASE_URL = SITE_URL;
