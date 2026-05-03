/**
 * SEO URL Fallback
 *
 * Quando a query de dados (perfil/categoria/cidade) falha ou demora,
 * geramos `title`/`description` razoáveis a partir do próprio pathname.
 * Isso garante que o crawler nunca veja meta-tags vazias mesmo se o React
 * ainda não tiver hidratado os dados do Supabase.
 *
 * Convenções de slug deste projeto:
 *   /profissional/:slug                    → Person/LocalBusiness
 *   /empresa/:slug                         → Organization
 *   /categoria/:slug                       → Category list
 *   /categoria/:slug/em/:cidade            → Category in City
 *   /especialidades/:slug                  → Specialty list
 *   /cidade/:slug | /cidades/:slug         → City list
 *   /buscar                                → Search
 *   /servicos | /vagas | /blog | /cursos   → Static
 */

const APP_NAME = 'Preciso de um';
const APP_TAGLINE = 'Encontre um profissional para qualquer tipo de serviço no Brasil';

export interface SeoFallback {
  title: string;
  description: string;
  ogType: 'website' | 'profile' | 'article';
}

/** Converte slug-com-hifen em "Slug Com Hifen" (Title Case PT-BR friendly). */
export function humanizeSlug(slug: string): string {
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      // preposições/artigos minúsculos no meio do nome
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ')
    .replace(/^(.)/, (m) => m.toUpperCase());
}

/**
 * Deriva título/descrição/og:type a partir do pathname.
 * Sempre retorna algo válido — nunca vazio.
 */
export function seoFallbackFromPath(pathname: string): SeoFallback {
  const path = (pathname || '/').split('?')[0].split('#')[0];
  const parts = path.split('/').filter(Boolean);

  // /profissional/:slug
  if (parts[0] === 'profissional' && parts[1]) {
    const name = humanizeSlug(parts[1]);
    return {
      title: `${name} — Profissional no ${APP_NAME}`,
      description: `Veja o perfil de ${name}, contato, avaliações e área de atendimento. ${APP_TAGLINE}.`,
      ogType: 'profile',
    };
  }

  // /empresa/:slug
  if (parts[0] === 'empresa' && parts[1]) {
    const name = humanizeSlug(parts[1]);
    return {
      title: `${name} — Empresa no ${APP_NAME}`,
      description: `Conheça ${name}, serviços oferecidos e contato. ${APP_TAGLINE}.`,
      ogType: 'profile',
    };
  }

  // /categoria/:slug/em/:cidade
  if (parts[0] === 'categoria' && parts[1] && parts[2] === 'em' && parts[3]) {
    const cat = humanizeSlug(parts[1]);
    const city = humanizeSlug(parts[3]);
    return {
      title: `${cat} em ${city} — Profissionais no ${APP_NAME}`,
      description: `Encontre ${cat.toLowerCase()} em ${city}. Avaliações, contato direto e atendimento na sua região.`,
      ogType: 'website',
    };
  }

  // /categoria/:slug
  if (parts[0] === 'categoria' && parts[1]) {
    const cat = humanizeSlug(parts[1]);
    return {
      title: `${cat} — Profissionais no ${APP_NAME}`,
      description: `Encontre profissionais de ${cat.toLowerCase()} em todo o Brasil. ${APP_TAGLINE}.`,
      ogType: 'website',
    };
  }

  // /especialidades/:slug
  if (parts[0] === 'especialidades' && parts[1]) {
    const spec = humanizeSlug(parts[1]);
    return {
      title: `${spec} — Especialistas no ${APP_NAME}`,
      description: `Especialistas em ${spec.toLowerCase()}. ${APP_TAGLINE}.`,
      ogType: 'website',
    };
  }

  // /cidade/:slug | /cidades/:slug
  if ((parts[0] === 'cidade' || parts[0] === 'cidades') && parts[1]) {
    const city = humanizeSlug(parts[1]);
    return {
      title: `Profissionais em ${city} — ${APP_NAME}`,
      description: `Encontre profissionais de confiança em ${city}. ${APP_TAGLINE}.`,
      ogType: 'website',
    };
  }

  // Estáticas
  const STATIC: Record<string, SeoFallback> = {
    '/buscar': {
      title: `Buscar profissionais — ${APP_NAME}`,
      description: `Pesquise profissionais por categoria, cidade ou CEP. ${APP_TAGLINE}.`,
      ogType: 'website',
    },
    '/categorias': {
      title: `Categorias de serviços — ${APP_NAME}`,
      description: `Navegue por todas as categorias de serviços disponíveis no ${APP_NAME}.`,
      ogType: 'website',
    },
    '/cidades': {
      title: `Cidades atendidas — ${APP_NAME}`,
      description: `Veja todas as cidades com profissionais cadastrados no ${APP_NAME}.`,
      ogType: 'website',
    },
    '/profissionais': {
      title: `Profissionais cadastrados — ${APP_NAME}`,
      description: `Lista de profissionais ativos no ${APP_NAME}.`,
      ogType: 'website',
    },
    '/blog': {
      title: `Blog — ${APP_NAME}`,
      description: `Artigos, dicas e novidades sobre serviços profissionais.`,
      ogType: 'website',
    },
    '/vagas': {
      title: `Vagas de serviços — ${APP_NAME}`,
      description: `Oportunidades abertas e pedidos de serviço em todo o Brasil.`,
      ogType: 'website',
    },
    '/cursos': {
      title: `Cursos gratuitos — ${APP_NAME}`,
      description: `Capacitação gratuita para profissionais autônomos.`,
      ogType: 'website',
    },
  };
  if (STATIC[path]) return STATIC[path];

  // Default genérico
  return {
    title: APP_NAME,
    description: APP_TAGLINE,
    ogType: 'website',
  };
}
