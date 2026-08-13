/**
 * BRAND CONFIG — fonte única de marca, domínio e nicho.
 *
 * Todo dado de identidade usado em canonical, OG, JSON-LD, sitemap e
 * conteúdo SEO deve vir daqui. Para "remixar" o portal para outro nicho
 * ou domínio, altere apenas este arquivo (ou as variáveis de ambiente).
 *
 * Ordem de precedência: VITE_* (build) → process.env (node/scripts) → default.
 */

function readEnv(key: string): string | undefined {
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | undefined> }).env
      : undefined;
  const fromVite = viteEnv?.[`VITE_${key}`];
  const fromNode =
    typeof process !== 'undefined' && process.env
      ? process.env[`VITE_${key}`] || process.env[key]
      : undefined;
  const value = (fromVite || fromNode || '').trim();
  return value || undefined;
}

function normalizeBaseUrl(raw: string): string {
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}

export interface BrandNiche {
  /** Nicho no singular, usado em títulos. Ex.: "profissional" */
  professionalNoun: string;
  /** Nicho no plural. Ex.: "profissionais" */
  professionalNounPlural: string;
  /** Termo de serviço. Ex.: "serviço" */
  serviceNoun: string;
  /** Segmento comercial para JSON-LD/descrições. */
  segment: string;
  /** País/idioma padrão. */
  locale: string;
  country: string;
}

export interface BrandConfig {
  name: string;
  legalName: string;
  tagline: string;
  description: string;
  baseUrl: string;
  domain: string;
  locale: string;
  niche: BrandNiche;
  social: { instagram?: string; facebook?: string; linkedin?: string; youtube?: string };
  contactEmail: string;
}

const DEFAULT_BASE_URL = 'https://precisodeum.com.br';

const baseUrl = normalizeBaseUrl(readEnv('SITE_BASE_URL') || DEFAULT_BASE_URL);

export const BRAND: BrandConfig = {
  name: readEnv('BRAND_NAME') || 'Preciso de um',
  legalName: readEnv('BRAND_LEGAL_NAME') || 'Preciso de um',
  tagline:
    readEnv('BRAND_TAGLINE') ||
    'Encontre um profissional para qualquer tipo de serviço no Brasil',
  description:
    readEnv('BRAND_DESCRIPTION') ||
    'Encontre profissionais qualificados perto de você, compare perfis e peça orçamento direto pelo WhatsApp, sem intermediários.',
  baseUrl,
  domain: (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return 'precisodeum.com.br';
    }
  })(),
  locale: readEnv('BRAND_LOCALE') || 'pt-BR',
  niche: {
    professionalNoun: readEnv('NICHE_PROFESSIONAL') || 'profissional',
    professionalNounPlural: readEnv('NICHE_PROFESSIONAL_PLURAL') || 'profissionais',
    serviceNoun: readEnv('NICHE_SERVICE') || 'serviço',
    segment: readEnv('NICHE_SEGMENT') || 'Serviços locais',
    locale: readEnv('BRAND_LOCALE') || 'pt-BR',
    country: readEnv('BRAND_COUNTRY') || 'BR',
  },
  social: {
    instagram: readEnv('SOCIAL_INSTAGRAM'),
    facebook: readEnv('SOCIAL_FACEBOOK'),
    linkedin: readEnv('SOCIAL_LINKEDIN'),
    youtube: readEnv('SOCIAL_YOUTUBE'),
  },
  contactEmail: readEnv('BRAND_CONTACT_EMAIL') || 'contato@precisodeum.com.br',
};

/** Base URL canônica (sem trailing slash). */
export const BRAND_BASE_URL = BRAND.baseUrl;

/** Sufixo padrão de <title>. */
export const brandTitleSuffix = (): string => BRAND.name;

/** Aplica o sufixo de marca, evitando duplicação. */
export const withBrandTitle = (title: string): string =>
  title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`;

/** Lista de perfis sociais para `sameAs` do JSON-LD. */
export const brandSameAs = (): string[] =>
  Object.values(BRAND.social).filter((v): v is string => !!v);
