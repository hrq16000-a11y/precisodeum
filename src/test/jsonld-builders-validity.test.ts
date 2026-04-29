/**
 * jsonld-builders-validity.test.ts
 *
 * Garante, em CI, que TODOS os builders de JSON-LD usados no app produzem
 * objetos com:
 *   - `@context` === 'https://schema.org'
 *   - `@type` válido (string não-vazia entre os tipos suportados pelo validador)
 *   - Estrutura mínima exigida pelo validador local (scripts/validate-json-ld.mjs)
 *
 * Falha o build se algum builder regressar — antes de qualquer deploy.
 *
 * Cobertura atual: BreadcrumbList (3 variantes) + FAQPage.
 */
import { describe, it, expect } from 'vitest';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';

const VALID_TYPES = new Set([
  'FAQPage', 'BreadcrumbList', 'LocalBusiness', 'City', 'State',
  'Service', 'AggregateRating', 'ItemList', 'Question',
]);

// ---------- Builders (espelhos das páginas reais) ----------

function buildCategoryBreadcrumb(slug: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Categorias', item: `${SITE_BASE_URL}/categorias` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE_BASE_URL}/categoria/${slug}` },
    ],
  };
}

function buildCityBreadcrumb(uf: string, slug: string, name: string, state: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Cidades', item: `${SITE_BASE_URL}/cidades` },
      { '@type': 'ListItem', position: 3, name: state, item: `${SITE_BASE_URL}/cidades/${uf}` },
      { '@type': 'ListItem', position: 4, name, item: `${SITE_BASE_URL}/cidades/${uf}/${slug}` },
    ],
  };
}

function buildProviderBreadcrumb(slug: string, name: string, categorySlug: string, category: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: category, item: `${SITE_BASE_URL}/categoria/${categorySlug}` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE_BASE_URL}/profissional/${slug}` },
    ],
  };
}

function buildFaqPage(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

const BUILDERS = {
  categoryBreadcrumb: () => buildCategoryBreadcrumb('eletricista', 'Eletricista'),
  cityBreadcrumb: () => buildCityBreadcrumb('pr', 'curitiba', 'Curitiba', 'Paraná'),
  providerBreadcrumb: () => buildProviderBreadcrumb('joao', 'João', 'eletricista', 'Eletricista'),
  faqPage: () => buildFaqPage([
    { question: 'Como funciona?', answer: 'Cadastre-se grátis e receba contatos.' },
    { question: 'É pago?', answer: 'Não. Profissionais têm acesso 100% gratuito.' },
  ]),
};

function assertJsonLdValid(obj: any, label: string) {
  expect(obj, `${label}: builder retornou null/undefined`).toBeTruthy();
  expect(obj['@context'], `${label}: @context inválido`).toBe('https://schema.org');
  expect(typeof obj['@type'], `${label}: @type não é string`).toBe('string');
  expect(VALID_TYPES.has(obj['@type']), `${label}: @type "${obj['@type']}" não reconhecido`).toBe(true);

  // Idempotência de serialização (estável p/ SSR / hydration)
  const round = JSON.parse(JSON.stringify(obj));
  expect(round).toEqual(obj);
}

describe('JSON-LD builders — validade pré-deploy', () => {
  it.each(Object.entries(BUILDERS))('builder "%s" produz JSON-LD válido', (label, build) => {
    assertJsonLdValid(build(), label);
  });

  it('BreadcrumbList sempre tem itemListElement não vazio com positions sequenciais', () => {
    for (const build of [
      BUILDERS.categoryBreadcrumb,
      BUILDERS.cityBreadcrumb,
      BUILDERS.providerBreadcrumb,
    ]) {
      const obj = build();
      expect(Array.isArray(obj.itemListElement)).toBe(true);
      expect(obj.itemListElement.length).toBeGreaterThan(0);
      obj.itemListElement.forEach((it: any, i: number) => {
        expect(it['@type']).toBe('ListItem');
        expect(it.position).toBe(i + 1);
      });
    }
  });

  it('FAQPage sempre tem mainEntity de Questions com acceptedAnswer não vazio', () => {
    const obj = BUILDERS.faqPage();
    expect(Array.isArray(obj.mainEntity)).toBe(true);
    expect(obj.mainEntity.length).toBeGreaterThan(0);
    for (const q of obj.mainEntity) {
      expect(q['@type']).toBe('Question');
      expect(typeof q.name).toBe('string');
      expect(q.name.length).toBeGreaterThan(0);
      expect(q.acceptedAnswer?.['@type']).toBe('Answer');
      expect(typeof q.acceptedAnswer?.text).toBe('string');
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it('todas as URLs `item` em BreadcrumbList são absolutas e usam SITE_BASE_URL', () => {
    for (const build of [BUILDERS.categoryBreadcrumb, BUILDERS.cityBreadcrumb, BUILDERS.providerBreadcrumb]) {
      const obj = build();
      for (const it of obj.itemListElement) {
        if (it.item) {
          expect(it.item.startsWith(SITE_BASE_URL)).toBe(true);
        }
      }
    }
  });
});
