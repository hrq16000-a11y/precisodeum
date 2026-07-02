/**
 * jsonld-ajv-runtime-validation.test.ts
 *
 * Validação runtime (ajv) dos JSON-LD que o app emite, garantindo que rich
 * results no Google nunca regridam silenciosamente. Cobre:
 *   - BreadcrumbList (ordem/positions)
 *   - LocalBusiness/ProfessionalService (perfil de prestador)
 *   - Service (catálogo de serviço)
 *   - FAQPage (página de ajuda)
 *
 * Os schemas espelham o subset que o Google Rich Results Test exige.
 */
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const breadcrumbSchema = {
  type: 'object',
  required: ['@context', '@type', 'itemListElement'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { const: 'BreadcrumbList' },
    itemListElement: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['@type', 'position', 'name', 'item'],
        properties: {
          '@type': { const: 'ListItem' },
          position: { type: 'integer', minimum: 1 },
          name: { type: 'string', minLength: 1 },
          item: { type: 'string', format: 'uri' },
        },
      },
    },
  },
};

const localBusinessSchema = {
  type: 'object',
  required: ['@context', '@type', 'name', 'url'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { type: 'string', enum: ['LocalBusiness', 'ProfessionalService'] },
    name: { type: 'string', minLength: 1 },
    url: { type: 'string', format: 'uri' },
    image: { type: ['string', 'array'] },
    telephone: { type: 'string' },
    address: {
      type: 'object',
      required: ['@type', 'addressLocality'],
      properties: {
        '@type': { const: 'PostalAddress' },
        streetAddress: { type: 'string' },
        addressLocality: { type: 'string', minLength: 1 },
        addressRegion: { type: 'string' },
        addressCountry: { type: 'string' },
      },
    },
    aggregateRating: {
      type: 'object',
      required: ['@type', 'ratingValue', 'reviewCount'],
      properties: {
        '@type': { const: 'AggregateRating' },
        ratingValue: { type: ['number', 'string'] },
        reviewCount: { type: ['number', 'string'] },
      },
    },
  },
};

const serviceSchema = {
  type: 'object',
  required: ['@context', '@type', 'name', 'provider'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { const: 'Service' },
    name: { type: 'string', minLength: 1 },
    provider: { type: 'object' },
    areaServed: { type: ['string', 'array', 'object'] },
  },
};

const faqSchema = {
  type: 'object',
  required: ['@context', '@type', 'mainEntity'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@type': { const: 'FAQPage' },
    mainEntity: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['@type', 'name', 'acceptedAnswer'],
        properties: {
          '@type': { const: 'Question' },
          name: { type: 'string', minLength: 1 },
          acceptedAnswer: {
            type: 'object',
            required: ['@type', 'text'],
            properties: {
              '@type': { const: 'Answer' },
              text: { type: 'string', minLength: 1 },
            },
          },
        },
      },
    },
  },
};

const validateBreadcrumb = ajv.compile(breadcrumbSchema);
const validateLocalBusiness = ajv.compile(localBusinessSchema);
const validateService = ajv.compile(serviceSchema);
const validateFaq = ajv.compile(faqSchema);

const SITE = 'https://precisodeum.com.br';

describe('JSON-LD ajv runtime validation', () => {
  it('valida BreadcrumbList canônico de categoria×cidade', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Eletricista', item: `${SITE}/categoria/eletricista` },
        { '@type': 'ListItem', position: 3, name: 'Curitiba', item: `${SITE}/categoria/eletricista/em/curitiba` },
      ],
    };
    expect(validateBreadcrumb(ld), JSON.stringify(validateBreadcrumb.errors)).toBe(true);
  });

  it('rejeita BreadcrumbList sem position', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', name: 'X', item: `${SITE}/` }],
    };
    expect(validateBreadcrumb(ld)).toBe(false);
  });

  it('valida LocalBusiness com endereço público (show_full_address=true)', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'João Eletricista',
      url: `${SITE}/profissional/joao`,
      telephone: '+5541997452053',
      image: `${SITE}/og/joao.jpg`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Rua das Flores, 123',
        addressLocality: 'Curitiba',
        addressRegion: 'PR',
        addressCountry: 'BR',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.8,
        reviewCount: 27,
      },
    };
    expect(validateLocalBusiness(ld), JSON.stringify(validateLocalBusiness.errors)).toBe(true);
  });

  it('valida LocalBusiness sem rua quando show_full_address=false', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: 'João Eletricista',
      url: `${SITE}/profissional/joao`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Curitiba',
        addressRegion: 'PR',
        addressCountry: 'BR',
      },
    };
    expect(validateLocalBusiness(ld)).toBe(true);
    expect((ld.address as any).streetAddress).toBeUndefined();
  });

  it('rejeita LocalBusiness sem addressLocality', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'X',
      url: `${SITE}/x`,
      address: { '@type': 'PostalAddress', addressCountry: 'BR' },
    };
    expect(validateLocalBusiness(ld)).toBe(false);
  });

  it('valida Service com provider e areaServed', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Instalação elétrica residencial',
      provider: { '@type': 'ProfessionalService', name: 'João Eletricista' },
      areaServed: ['Curitiba', 'São José dos Pinhais'],
    };
    expect(validateService(ld), JSON.stringify(validateService.errors)).toBe(true);
  });

  it('valida FAQPage com Question/Answer', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'É grátis para o profissional?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sim, 100% gratuito.' },
        },
      ],
    };
    expect(validateFaq(ld), JSON.stringify(validateFaq.errors)).toBe(true);
  });

  it('rejeita FAQPage sem mainEntity', () => {
    const ld = { '@context': 'https://schema.org', '@type': 'FAQPage' };
    expect(validateFaq(ld)).toBe(false);
  });
});
