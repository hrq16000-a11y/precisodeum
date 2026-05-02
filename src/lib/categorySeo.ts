/**
 * Contrato SEO compartilhado entre `CategoryPage` (/categoria/:slug) e
 * `EspecialidadeDetailPage` (/especialidades/:slug).
 *
 * Centralizar essas funções permite:
 *   1. Garantir consistência de H1, meta description, canonical e breadcrumbs.
 *   2. Cobrir o contrato com testes unitários sem montar a árvore React inteira.
 *   3. Aplicar `noindex` automaticamente quando a categoria está ausente (fallback SEO seguro).
 */

export interface CategorySeoInput {
  slug: string | undefined | null;
  category: { name: string; slug: string } | null | undefined;
  city?: string | null;
  providersCount?: number;
}

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string | undefined;
  noindex: boolean;
  h1: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

const SITE_BASE_URL = 'https://precisodeum.com.br';

const safeName = (slug: string | null | undefined) =>
  (slug || '').replace(/-/g, ' ').trim();

/**
 * SEO meta para /categoria/:slug.
 * Fallback: quando `category` é null/undefined, retorna `noindex: true` e descrição genérica.
 */
export function getCategorySeoMeta(input: CategorySeoInput): SeoMeta {
  const { slug, category, city, providersCount = 0 } = input;
  const found = !!category;
  const name = category?.name || safeName(slug);

  if (!found) {
    return {
      title: 'Categoria não encontrada | Preciso de um',
      description: 'Esta categoria não existe ou foi removida. Veja outras especialidades disponíveis.',
      canonical: slug ? `${SITE_BASE_URL}/categoria/${slug}` : undefined,
      noindex: true,
      h1: 'Categoria não encontrada',
    };
  }

  const title = city
    ? `${name} em ${city} - Profissionais Verificados | Preciso de Um`
    : `${name} no Brasil - Profissionais Verificados | Preciso de Um`;

  const description = city
    ? `Os melhores profissionais de ${name} em ${city}. ${providersCount} prestadores verificados, avaliados pela comunidade. Contato direto pelo WhatsApp.`
    : `Encontre os melhores profissionais verificados de ${name} no Brasil. ${providersCount} prestadores cadastrados com avaliações reais.`;

  return {
    title,
    description,
    canonical: `${SITE_BASE_URL}/categoria/${category!.slug}`,
    noindex: false,
    h1: name,
  };
}

/**
 * SEO meta para /especialidades/:slug.
 * Mesmas garantias de fallback. Diferencia-se por ter foco em "Dicas de Especialista".
 */
export function getEspecialidadeSeoMeta(input: CategorySeoInput): SeoMeta {
  const { slug, category } = input;
  const found = !!category;
  const name = category?.name || safeName(slug);

  if (!found) {
    return {
      title: 'Especialidade não encontrada | Preciso de um',
      description: 'Esta especialidade não está disponível. Veja outras especialidades no nosso diretório.',
      canonical: slug ? `${SITE_BASE_URL}/especialidades/${slug}` : undefined,
      noindex: true,
      h1: 'Especialidade não encontrada',
    };
  }

  return {
    title: `${name}: Dicas de Especialista e Profissionais`,
    description: `Encontre os melhores profissionais de ${name.toLowerCase()} no Brasil. Dicas de especialista, avaliações e contato direto via WhatsApp.`,
    canonical: `${SITE_BASE_URL}/especialidades/${category!.slug}`,
    noindex: false,
    h1: name,
  };
}

/**
 * Breadcrumbs canônicos para /categoria/:slug.
 * Sempre retorna ao menos 2 itens (Início → Categorias) mesmo no fallback.
 */
export function getCategoryBreadcrumbs(input: CategorySeoInput): BreadcrumbItem[] {
  const { category } = input;
  const items: BreadcrumbItem[] = [
    { name: 'Início', url: `${SITE_BASE_URL}/` },
    { name: 'Categorias', url: `${SITE_BASE_URL}/categorias` },
  ];
  if (category) {
    items.push({
      name: category.name,
      url: `${SITE_BASE_URL}/categoria/${category.slug}`,
    });
  }
  return items;
}

/**
 * Breadcrumbs canônicos para /especialidades/:slug.
 */
export function getEspecialidadeBreadcrumbs(input: CategorySeoInput): BreadcrumbItem[] {
  const { category, slug } = input;
  const items: BreadcrumbItem[] = [
    { name: 'Início', url: `${SITE_BASE_URL}/` },
    { name: 'Especialidades', url: `${SITE_BASE_URL}/especialidades` },
  ];
  if (category) {
    items.push({
      name: category.name,
      url: `${SITE_BASE_URL}/especialidades/${category.slug}`,
    });
  } else if (slug) {
    // No fallback ainda mostramos o slug "humanizado" para o usuário não ficar perdido,
    // mas a página é noindex.
    items.push({
      name: safeName(slug),
      url: `${SITE_BASE_URL}/especialidades/${slug}`,
    });
  }
  return items;
}
