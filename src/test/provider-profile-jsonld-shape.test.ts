/**
 * Validação estática do JSON-LD `LocalBusiness/ProfessionalService` e do
 * `BreadcrumbList` injetados em ProviderProfile.tsx.
 *
 * Não roda o componente — escaneia o source como string para garantir que os
 * campos críticos para Rich Results do Google sigam presentes:
 *  - @context schema.org
 *  - @type ProfessionalService + LocalBusiness (subtype)
 *  - address {addressLocality, addressRegion, addressCountry: 'BR'}
 *  - geo (quando lat/lng presentes)
 *  - aggregateRating (quando review_count > 0)
 *  - areaServed.City
 *  - hasOfferCatalog/Offer/Service
 *  - BreadcrumbList com ListItem.position/name/item
 *
 * Falhar este teste = SEO regressão estrutural — bloquear merge.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/pages/ProviderProfile.tsx'),
  'utf8',
);

describe('ProviderProfile — JSON-LD shape (Rich Results)', () => {
  it('injeta os 3 blocos via useJsonLd: breadcrumb + localBusiness + person', () => {
    expect(SRC).toMatch(/useJsonLd\(breadcrumbLd\)/);
    expect(SRC).toMatch(/useJsonLd\(localBusinessLd\)/);
    expect(SRC).toMatch(/useJsonLd\(personLd\)/);
  });

  it('LocalBusiness usa ProfessionalService como subtype', () => {
    expect(SRC).toMatch(/'@type':\s*\['ProfessionalService',\s*'LocalBusiness'\]/);
  });

  it('LocalBusiness tem @context schema.org', () => {
    // Pelo menos uma ocorrência do @context — aplica-se a todos os blocos.
    expect(SRC).toMatch(/'@context':\s*'https:\/\/schema\.org'/);
  });

  it('BreadcrumbList com ListItem position/name/item', () => {
    expect(SRC).toMatch(/'@type':\s*'BreadcrumbList'/);
    expect(SRC).toMatch(/'@type':\s*'ListItem'/);
    // O 1º item é literal (Início); itens subsequentes usam contador dinâmico `pos++`.
    expect(SRC).toMatch(/position:\s*1/);
    expect(SRC).toMatch(/position:\s*(?:2|pos\+\+|pos)/);
  });

  it('PostalAddress sem addressLocality duplicado e country=BR', () => {
    expect(SRC).toMatch(/'@type':\s*'PostalAddress'/);
    expect(SRC).toMatch(/addressCountry:\s*'BR'/);
    // streetAddress real só com show_full_address (privacidade + correto p/ Rich Results)
    expect(SRC).toMatch(/show_full_address[^]*streetAddress/);
    // Não pode haver duas linhas de addressLocality consecutivas com mesmo valor
    // (regressão antiga: bairro e cidade ambos como locality).
    const dup = SRC.match(/addressLocality[^,}]*\n[^}]*addressLocality/);
    expect(dup).toBeNull();
  });

  it('aggregateRating é condicional a review_count > 0 com bestRating/worstRating', () => {
    expect(SRC).toMatch(/review_count\s*>\s*0/);
    expect(SRC).toMatch(/aggregateRating:\s*\{[^}]*'@type':\s*'AggregateRating'/s);
    expect(SRC).toMatch(/bestRating:\s*5/);
    expect(SRC).toMatch(/worstRating:\s*1/);
  });

  it('GeoCoordinates incluído quando latitude/longitude presentes', () => {
    expect(SRC).toMatch(/'@type':\s*'GeoCoordinates'/);
    expect(SRC).toMatch(/latitude:\s*Number\(provider\.latitude\)/);
    expect(SRC).toMatch(/longitude:\s*Number\(provider\.longitude\)/);
  });

  it('areaServed.City com containedInPlace.AdministrativeArea', () => {
    expect(SRC).toMatch(/areaServed:\s*\{[^}]*'@type':\s*'City'/s);
    expect(SRC).toMatch(/containedInPlace:[^}]*'@type':\s*'AdministrativeArea'/s);
  });

  it('hasOfferCatalog com Service + Offer + priceCurrency BRL', () => {
    expect(SRC).toMatch(/'@type':\s*'OfferCatalog'/);
    expect(SRC).toMatch(/'@type':\s*'Offer'/);
    expect(SRC).toMatch(/'@type':\s*'Service'/);
    expect(SRC).toMatch(/priceCurrency:\s*'BRL'/);
  });

  it('Person schema espelha jobTitle + worksFor da plataforma', () => {
    expect(SRC).toMatch(/'@type':\s*'Person'/);
    expect(SRC).toMatch(/jobTitle:/);
    expect(SRC).toMatch(/worksFor:[^}]*'@type':\s*'Organization'/s);
  });
});

describe('CategoryCityPage / CityDetailPage — JSON-LD shape', () => {
  const CCP = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/CategoryCityPage.tsx'),
    'utf8',
  );
  const CDP = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/CityDetailPage.tsx'),
    'utf8',
  );

  it('CategoryCityPage emite ItemList com itemListElement', () => {
    expect(CCP).toMatch(/'@type':\s*'ItemList'/);
    expect(CCP).toMatch(/itemListElement:/);
    expect(CCP).toMatch(/'@type':\s*'ListItem'/);
  });

  it('CityDetailPage emite LocalBusiness para cada provider listado', () => {
    expect(CDP).toMatch(/'@type':\s*'LocalBusiness'/);
    expect(CDP).toMatch(/'@type':\s*'BreadcrumbList'/);
  });
});
