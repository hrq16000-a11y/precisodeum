import { Helmet } from 'react-helmet-async';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';
import { buildCanonicalUrl } from '@/lib/canonicalUrl';
import { normalizeSocialImageUrl } from '@/lib/imageUrlNormalizer';

/**
 * SeoMeta — wrapper enxuto sobre react-helmet-async para metadata per-route.
 *
 * Emite: title, description, canonical, og:title, og:description, og:type, og:url
 * (e og:image quando houver imagem válida).
 *
 * Uso: substitui useSeoHead nas páginas indexáveis críticas. Helmet faz dedup
 * por chave de tag, evitando duplicidade quando esta é a única fonte de SEO da
 * página. Não emite robots/Twitter/JSON-LD/image-probe — esses ficam por conta
 * de hooks especializados (useJsonLd) ou do fallback sitewide em index.html.
 */
export interface SeoMetaProps {
  title: string;
  description: string;
  /** Path relativo ('/categoria/foo') ou URL absoluta. Se omitido, usa pathname atual. */
  canonical?: string;
  ogType?: 'website' | 'article' | 'profile';
  /** URL absoluta ou relativa da imagem de compartilhamento. Opcional. */
  ogImage?: string;
}

const SUFFIX = 'Preciso de um';

function withSuffix(title: string) {
  if (!title || title.trim().length < 3) return SUFFIX;
  return title.includes(SUFFIX) ? title : `${title} | ${SUFFIX}`;
}

export function SeoMeta({ title, description, canonical, ogType = 'website', ogImage }: SeoMetaProps) {
  const fullTitle = withSuffix(title);
  const desc = (description && description.trim().length >= 10)
    ? description
    : 'Encontre um profissional para qualquer tipo de serviço no Brasil.';

  const pathOrUrl = canonical
    || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const canonicalUrl = buildCanonicalUrl(pathOrUrl);
  const resolvedImage = ogImage ? normalizeSocialImageUrl(ogImage, 'og:image') : undefined;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      {resolvedImage && <meta property="og:image" content={resolvedImage} />}
    </Helmet>
  );
}

export { SITE_BASE_URL };
export default SeoMeta;
