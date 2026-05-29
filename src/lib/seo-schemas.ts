/**
 * seo-schemas.ts — Builders puros de JSON-LD (schema.org) para Rich Results.
 *
 * Fonte única para montar objetos JSON-LD validados pelo Google. Cada função
 * é PURA: recebe dados, retorna o objeto. Sem side-effects, sem DOM.
 *
 * Injeção no <head> é feita pelo hook `useJsonLd` (single tag por @type/id)
 * — este módulo apenas constrói o payload.
 *
 * Padrão arquitetural:
 *   const ld = buildBreadcrumbList([...]);
 *   useJsonLd(ld, 'breadcrumb');
 *
 * Onde houver páginas com regex-tests guardando literais (ProviderProfile,
 * CategoryPage, CityPage), a construção continua inline — esses arquivos
 * devem replicar a mesma forma que estes helpers retornam.
 */
import { SITE_BASE_URL } from '@/hooks/useSeoHead';

// ---------- Tipos públicos ----------

export interface BreadcrumbItem {
  name: string;
  /** Path relativo ('/categorias/x') ou URL absoluta. O último item costuma omitir `url`. */
  url?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProfessionalServiceInput {
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  /** Bairro — vira `addressLocality` secundário só se diferente de city. */
  neighborhood?: string | null;
  /** Logradouro completo — só inclui quando o profissional autorizou exibir. */
  streetAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Média (0–5) e total de avaliações; só emite AggregateRating quando count > 0. */
  ratingAverage?: number | null;
  reviewCount?: number | null;
  /** Categorias/serviços para hasOfferCatalog. */
  services?: Array<{ name: string; description?: string | null }>;
}

export interface ItemListProviderInput {
  position: number;
  name: string;
  url: string;
}

// ---------- Helpers internos ----------

const SCHEMA = 'https://schema.org';

function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return SITE_BASE_URL + '/';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function clean<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

// ---------- Builders ----------

/**
 * Organization sitewide — útil para `index.html` ou Helmet root.
 */
export function buildOrganization(opts?: { name?: string; url?: string; logo?: string }) {
  return clean({
    '@context': SCHEMA,
    '@type': 'Organization',
    name: opts?.name ?? 'Preciso de um Profissional',
    url: opts?.url ?? SITE_BASE_URL,
    logo: opts?.logo,
  });
}

/**
 * BreadcrumbList — árvore lógica para "Início > Categoria > Cidade".
 * O último item pode omitir `url` (o Google interpreta como página atual).
 */
export function buildBreadcrumbList(items: BreadcrumbItem[]) {
  if (!items || items.length === 0) return null;
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => clean({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url ? absoluteUrl(it.url) : undefined,
    })),
  };
}

/**
 * FAQPage — emite Rich Snippet de perguntas frequentes.
 */
export function buildFaqPage(faqs: FaqItem[]) {
  if (!faqs || faqs.length === 0) return null;
  return {
    '@context': SCHEMA,
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/**
 * ProfessionalService (com LocalBusiness como subtype) — o schema-chave do
 * perfil profissional. Emite AggregateRating só quando há avaliações reais.
 */
export function buildProfessionalServiceSchema(p: ProfessionalServiceInput) {
  if (!p?.name || !p?.slug) return null;
  const url = `${SITE_BASE_URL}/profissional/${p.slug}`;

  const address = (p.city || p.state) ? clean({
    '@type': 'PostalAddress',
    streetAddress: p.streetAddress || undefined,
    addressLocality: p.city || undefined,
    addressRegion: p.state || undefined,
    addressCountry: 'BR',
  }) : undefined;

  const geo = (p.latitude != null && p.longitude != null) ? {
    '@type': 'GeoCoordinates',
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
  } : undefined;

  const areaServed = p.city ? {
    '@type': 'City',
    name: p.city,
    containedInPlace: p.state ? { '@type': 'AdministrativeArea', name: p.state } : undefined,
  } : undefined;

  const aggregateRating = (p.reviewCount && p.reviewCount > 0 && p.ratingAverage != null) ? {
    '@type': 'AggregateRating',
    ratingValue: Number(p.ratingAverage).toFixed(1),
    reviewCount: p.reviewCount,
    bestRating: 5,
    worstRating: 1,
  } : undefined;

  const hasOfferCatalog = (p.services && p.services.length > 0) ? {
    '@type': 'OfferCatalog',
    name: `Serviços de ${p.name}`,
    itemListElement: p.services.map((s) => ({
      '@type': 'Offer',
      itemOffered: clean({
        '@type': 'Service',
        name: s.name,
        description: s.description || undefined,
        areaServed: areaServed,
      }),
      priceCurrency: 'BRL',
    })),
  } : undefined;

  return clean({
    '@context': SCHEMA,
    '@type': ['ProfessionalService', 'LocalBusiness'],
    name: p.name,
    description: p.description || undefined,
    image: p.image || undefined,
    url,
    telephone: p.phone || undefined,
    email: p.email || undefined,
    address,
    geo,
    areaServed,
    aggregateRating,
    hasOfferCatalog,
  });
}

/**
 * Person — espelho do profissional como pessoa física, útil em perfis
 * autônomos. Complementa (não substitui) o ProfessionalService.
 */
export function buildPersonSchema(input: {
  name: string;
  slug: string;
  image?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  if (!input?.name || !input?.slug) return null;
  const address = (input.city || input.state) ? clean({
    '@type': 'PostalAddress',
    addressLocality: input.city || undefined,
    addressRegion: input.state || undefined,
    addressCountry: 'BR',
  }) : undefined;
  return clean({
    '@context': SCHEMA,
    '@type': 'Person',
    name: input.name,
    url: `${SITE_BASE_URL}/profissional/${input.slug}`,
    image: input.image || undefined,
    jobTitle: input.jobTitle || undefined,
    address,
    worksFor: { '@type': 'Organization', name: 'Preciso de um', url: SITE_BASE_URL },
  });
}

/**
 * ItemList genérico — para listagens de profissionais em páginas de busca,
 * categoria ou cidade. Cada item aponta para o perfil correspondente.
 */
export function buildItemList(items: ItemListProviderInput[], name?: string) {
  if (!items || items.length === 0) return null;
  return clean({
    '@context': SCHEMA,
    '@type': 'ItemList',
    name: name,
    itemListElement: items.map((it) => ({
      '@type': 'ListItem',
      position: it.position,
      name: it.name,
      url: absoluteUrl(it.url),
    })),
  });
}

/**
 * Service de catálogo (categoria) — descreve uma categoria como serviço
 * ofertado pela plataforma na área geográfica indicada.
 */
export function buildServiceSchema(input: {
  name: string;
  description?: string | null;
  areaCity?: string | null;
  providerOrgName?: string;
  ratingAverage?: number | null;
  reviewCount?: number | null;
}) {
  if (!input?.name) return null;
  const aggregateRating = (input.reviewCount && input.reviewCount > 0 && input.ratingAverage != null) ? {
    '@type': 'AggregateRating',
    ratingValue: Number(input.ratingAverage).toFixed(1),
    reviewCount: input.reviewCount,
    bestRating: 5,
    worstRating: 1,
  } : undefined;
  return clean({
    '@context': SCHEMA,
    '@type': 'Service',
    name: input.name,
    description: input.description || undefined,
    areaServed: input.areaCity
      ? { '@type': 'City', name: input.areaCity }
      : { '@type': 'Country', name: 'Brasil' },
    provider: {
      '@type': 'Organization',
      name: input.providerOrgName ?? 'Preciso de um',
      url: SITE_BASE_URL,
    },
    aggregateRating,
  });
}

/**
 * CollectionPage — usada para indicar que a URL é uma "página de coleção"
 * (lista de profissionais por cidade ou categoria).
 */
export function buildCollectionPage(input: {
  url: string;
  name: string;
  description?: string | null;
  about?: { type: 'City' | 'Service'; name: string; regionName?: string };
}) {
  if (!input?.url || !input?.name) return null;
  const about = input.about ? clean({
    '@type': input.about.type,
    name: input.about.name,
    containedInPlace: input.about.regionName
      ? { '@type': 'AdministrativeArea', name: input.about.regionName }
      : undefined,
  }) : undefined;
  return clean({
    '@context': SCHEMA,
    '@type': 'CollectionPage',
    url: absoluteUrl(input.url),
    name: input.name,
    description: input.description || undefined,
    isPartOf: { '@type': 'WebSite', url: SITE_BASE_URL, name: 'Preciso de um' },
    about,
  });
}
