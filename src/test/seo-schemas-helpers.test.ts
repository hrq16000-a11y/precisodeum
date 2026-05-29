/**
 * seo-schemas-helpers.test.ts
 *
 * Garante que os builders puros em `src/lib/seo-schemas.ts` produzem JSON-LD
 * válido (@context schema.org + @type correto + campos mínimos para Rich
 * Results). Falhar aqui = regressão crítica de SEO.
 */
import { describe, it, expect } from 'vitest';
import {
  buildOrganization,
  buildBreadcrumbList,
  buildFaqPage,
  buildProfessionalServiceSchema,
  buildPersonSchema,
  buildItemList,
  buildServiceSchema,
  buildCollectionPage,
} from '@/lib/seo-schemas';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';

describe('seo-schemas — builders puros', () => {
  it('Organization tem @context + @type + url absoluta', () => {
    const o = buildOrganization();
    expect(o['@context']).toBe('https://schema.org');
    expect(o['@type']).toBe('Organization');
    expect(o.url).toMatch(/^https?:\/\//);
  });

  it('BreadcrumbList tem positions sequenciais e itens absolutos', () => {
    const b = buildBreadcrumbList([
      { name: 'Início', url: '/' },
      { name: 'Categorias', url: '/categorias' },
      { name: 'Eletricista' },
    ])!;
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement).toHaveLength(3);
    b.itemListElement.forEach((it: any, i: number) => {
      expect(it['@type']).toBe('ListItem');
      expect(it.position).toBe(i + 1);
    });
    expect(b.itemListElement[0].item).toContain(SITE_BASE_URL);
    expect(b.itemListElement[2].item).toBeUndefined();
  });

  it('BreadcrumbList retorna null quando vazio', () => {
    expect(buildBreadcrumbList([])).toBeNull();
  });

  it('FAQPage mapeia Q/A para Question + acceptedAnswer.Answer', () => {
    const f = buildFaqPage([
      { question: 'É grátis?', answer: 'Sim, 100% gratuito para profissionais.' },
      { question: 'Como funciona?', answer: 'Cadastre-se e receba contatos.' },
    ])!;
    expect(f['@type']).toBe('FAQPage');
    expect(f.mainEntity).toHaveLength(2);
    for (const q of f.mainEntity) {
      expect(q['@type']).toBe('Question');
      expect(q.acceptedAnswer['@type']).toBe('Answer');
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });

  it('FAQPage retorna null quando lista vazia', () => {
    expect(buildFaqPage([])).toBeNull();
  });

  it('ProfessionalService inclui ProfessionalService+LocalBusiness, BR, geo, areaServed', () => {
    const p = buildProfessionalServiceSchema({
      name: 'João Eletricista',
      slug: 'joao-eletricista',
      description: 'Serviços elétricos residenciais.',
      city: 'Curitiba',
      state: 'PR',
      latitude: -25.4,
      longitude: -49.2,
      ratingAverage: 4.8,
      reviewCount: 12,
      services: [{ name: 'Instalação de chuveiro' }],
    })!;
    expect(p['@type']).toEqual(['ProfessionalService', 'LocalBusiness']);
    expect(p.address.addressCountry).toBe('BR');
    expect(p.address.addressLocality).toBe('Curitiba');
    expect(p.geo['@type']).toBe('GeoCoordinates');
    expect(p.areaServed['@type']).toBe('City');
    expect(p.areaServed.containedInPlace.name).toBe('PR');
    expect(p.aggregateRating['@type']).toBe('AggregateRating');
    expect(p.aggregateRating.bestRating).toBe(5);
    expect(p.aggregateRating.reviewCount).toBe(12);
    expect(p.hasOfferCatalog.itemListElement[0]['@type']).toBe('Offer');
    expect(p.hasOfferCatalog.itemListElement[0].priceCurrency).toBe('BRL');
  });

  it('ProfessionalService omite aggregateRating quando reviewCount=0', () => {
    const p = buildProfessionalServiceSchema({
      name: 'João',
      slug: 'joao',
      city: 'Curitiba',
      state: 'PR',
      ratingAverage: 0,
      reviewCount: 0,
    })!;
    expect(p.aggregateRating).toBeUndefined();
  });

  it('ProfessionalService retorna null sem name/slug', () => {
    expect(buildProfessionalServiceSchema({ name: '', slug: 'x' } as any)).toBeNull();
  });

  it('Person mapeia jobTitle e worksFor.Organization', () => {
    const p = buildPersonSchema({
      name: 'Maria',
      slug: 'maria',
      jobTitle: 'Diarista',
      city: 'São Paulo',
      state: 'SP',
    })!;
    expect(p['@type']).toBe('Person');
    expect(p.jobTitle).toBe('Diarista');
    expect(p.worksFor['@type']).toBe('Organization');
    expect(p.address.addressCountry).toBe('BR');
  });

  it('ItemList numera providers e gera URLs absolutas', () => {
    const il = buildItemList(
      [
        { position: 1, name: 'João', url: '/profissional/joao' },
        { position: 2, name: 'Maria', url: '/profissional/maria' },
      ],
      'Eletricistas em Curitiba',
    )!;
    expect(il['@type']).toBe('ItemList');
    expect(il.name).toBe('Eletricistas em Curitiba');
    expect(il.itemListElement[0].url).toContain(SITE_BASE_URL);
  });

  it('Service emite areaServed City quando areaCity fornecida; senão Country=Brasil', () => {
    const s1 = buildServiceSchema({ name: 'Eletricista', areaCity: 'Curitiba' })!;
    expect(s1.areaServed['@type']).toBe('City');
    const s2 = buildServiceSchema({ name: 'Eletricista' })!;
    expect(s2.areaServed['@type']).toBe('Country');
    expect(s2.areaServed.name).toBe('Brasil');
  });

  it('CollectionPage tem isPartOf WebSite e about polimórfico', () => {
    const c = buildCollectionPage({
      url: '/cidade/curitiba',
      name: 'Curitiba',
      about: { type: 'City', name: 'Curitiba', regionName: 'PR' },
    })!;
    expect(c['@type']).toBe('CollectionPage');
    expect(c.isPartOf['@type']).toBe('WebSite');
    expect(c.about['@type']).toBe('City');
    expect(c.about.containedInPlace.name).toBe('PR');
  });

  it('todos os builders retornam objetos serializáveis (idempotência JSON)', () => {
    const objs = [
      buildOrganization(),
      buildBreadcrumbList([{ name: 'Início', url: '/' }]),
      buildFaqPage([{ question: 'a', answer: 'b' }]),
      buildProfessionalServiceSchema({ name: 'X', slug: 'x', city: 'Curitiba', state: 'PR' }),
      buildPersonSchema({ name: 'X', slug: 'x' }),
      buildItemList([{ position: 1, name: 'a', url: '/a' }]),
      buildServiceSchema({ name: 'a' }),
      buildCollectionPage({ url: '/x', name: 'x' }),
    ];
    for (const o of objs) {
      expect(o).toBeTruthy();
      expect(JSON.parse(JSON.stringify(o))).toEqual(o);
    }
  });
});
