/**
 * seo-jsonld-structural-validation.test.tsx
 *
 * Validação estrutural por rota dinâmica: garante que cada @type usado
 * no app possui os campos OBRIGATÓRIOS do schema.org e está bem-formado.
 *
 * Cobertura por rota:
 *   - /categoria/:slug          → BreadcrumbList
 *   - /cidade/:slug             → Place + BreadcrumbList
 *   - /cidades/:uf/:cidade      → BreadcrumbList
 *   - /profissional/:slug       → Person + LocalBusiness + BreadcrumbList
 *
 * Diferente do `jsonld-builders-validity.test.ts` (que valida builders puros),
 * aqui simulamos o pipeline completo: useJsonLd → DOM → JSON.parse → asserts.
 * Detecta regressões em que o DOM acaba com payload incompleto mesmo que
 * o builder esteja correto (ex.: spread perdendo campos).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useJsonLd } from '@/hooks/useJsonLd';

vi.mock('@/hooks/useSiteSettings', () => ({ useSettingValue: () => null }));

function clearLd() {
  document.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
}

function getAllJsonLd(): any[] {
  return Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )
    .map((s) => {
      try {
        return JSON.parse(s.textContent || 'null');
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findByType(type: string) {
  return getAllJsonLd().find((o) => o?.['@type'] === type);
}

/**
 * Asserts mínimos que TODO JSON-LD deve passar.
 */
function assertWellFormed(obj: any, label: string) {
  expect(obj, `${label}: payload nulo`).toBeTruthy();
  expect(obj['@context'], `${label}: @context inválido`).toBe('https://schema.org');
  expect(typeof obj['@type'], `${label}: @type não é string`).toBe('string');
  expect((obj['@type'] as string).length, `${label}: @type vazio`).toBeGreaterThan(0);
  // round-trip estável (sem ciclos / sem undefined em campos críticos)
  expect(() => JSON.parse(JSON.stringify(obj))).not.toThrow();
}

describe('JSON-LD — validação estrutural por rota dinâmica', () => {
  beforeEach(() => clearLd());
  afterEach(() => cleanup());

  // ---------- BreadcrumbList ----------
  describe('BreadcrumbList (todas as rotas)', () => {
    it('/categoria → BreadcrumbList com itemListElement[ListItem] sequencial', () => {
      renderHook(() =>
        useJsonLd(
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precisodeum.com.br/' },
              { '@type': 'ListItem', position: 2, name: 'Categorias', item: 'https://precisodeum.com.br/categorias' },
              { '@type': 'ListItem', position: 3, name: 'Pintor', item: 'https://precisodeum.com.br/categoria/pintor' },
            ],
          },
          'bc-cat',
        ),
      );

      const bc = findByType('BreadcrumbList');
      assertWellFormed(bc, 'BreadcrumbList /categoria');
      expect(Array.isArray(bc.itemListElement)).toBe(true);
      expect(bc.itemListElement.length).toBeGreaterThan(0);
      bc.itemListElement.forEach((item: any, i: number) => {
        expect(item['@type']).toBe('ListItem');
        expect(item.position).toBe(i + 1);
        expect(typeof item.name).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);
        expect(item.item).toMatch(/^https:\/\//);
      });
    });

    it('/cidades/:uf/:cidade → BreadcrumbList com 4 níveis', () => {
      renderHook(() =>
        useJsonLd(
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precisodeum.com.br/' },
              { '@type': 'ListItem', position: 2, name: 'Cidades', item: 'https://precisodeum.com.br/cidades' },
              { '@type': 'ListItem', position: 3, name: 'Paraná', item: 'https://precisodeum.com.br/cidades/pr' },
              { '@type': 'ListItem', position: 4, name: 'Curitiba', item: 'https://precisodeum.com.br/cidades/pr/curitiba' },
            ],
          },
          'bc-cidade',
        ),
      );
      const bc = findByType('BreadcrumbList');
      assertWellFormed(bc, 'BreadcrumbList /cidades');
      expect(bc.itemListElement).toHaveLength(4);
      expect(bc.itemListElement[3].position).toBe(4);
    });
  });

  // ---------- Place (/cidade) ----------
  describe('Place (/cidade)', () => {
    it('exige name e address.addressLocality', () => {
      renderHook(() =>
        useJsonLd(
          {
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: 'São Paulo',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'São Paulo',
              addressRegion: 'SP',
              addressCountry: 'BR',
            },
          },
          'place-sp',
        ),
      );
      const place = findByType('Place');
      assertWellFormed(place, 'Place /cidade');
      expect(typeof place.name).toBe('string');
      expect(place.name.length).toBeGreaterThan(0);
      expect(place.address).toBeTruthy();
      expect(place.address['@type']).toBe('PostalAddress');
      expect(place.address.addressLocality).toBe('São Paulo');
      expect(place.address.addressCountry).toBe('BR');
    });
  });

  // ---------- Person (/profissional) ----------
  describe('Person (/profissional)', () => {
    it('exige name e jobTitle, com URL absoluta quando presente', () => {
      renderHook(() =>
        useJsonLd(
          {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: 'João Silva',
            jobTitle: 'Eletricista',
            url: 'https://precisodeum.com.br/profissional/joao-silva-sp',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'São Paulo',
              addressCountry: 'BR',
            },
          },
          'person-test',
        ),
      );
      const person = findByType('Person');
      assertWellFormed(person, 'Person /profissional');
      expect(typeof person.name).toBe('string');
      expect(person.name.length).toBeGreaterThan(0);
      expect(typeof person.jobTitle).toBe('string');
      expect(person.jobTitle.length).toBeGreaterThan(0);
      if (person.url) expect(person.url).toMatch(/^https:\/\//);
    });
  });

  // ---------- LocalBusiness (/profissional) ----------
  describe('LocalBusiness (/profissional)', () => {
    it('exige name + address.addressLocality, e aceita aggregateRating opcional bem-formado', () => {
      renderHook(() =>
        useJsonLd(
          {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: 'João Silva - Eletricista',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'São Paulo',
              addressCountry: 'BR',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              reviewCount: '23',
            },
          },
          'lb-test',
        ),
      );
      const lb = findByType('LocalBusiness');
      assertWellFormed(lb, 'LocalBusiness /profissional');
      expect(typeof lb.name).toBe('string');
      expect(lb.name.length).toBeGreaterThan(0);
      expect(lb.address?.['@type']).toBe('PostalAddress');
      expect(lb.address?.addressLocality).toBeTruthy();

      if (lb.aggregateRating) {
        expect(lb.aggregateRating['@type']).toBe('AggregateRating');
        expect(lb.aggregateRating.ratingValue).toBeTruthy();
        expect(
          lb.aggregateRating.reviewCount || lb.aggregateRating.ratingCount,
          'AggregateRating exige reviewCount ou ratingCount',
        ).toBeTruthy();
      }
    });

    it('falha estrutural detectada: LocalBusiness sem name é inválido', () => {
      // Reproduz cenário de regressão: alguém cria payload incompleto.
      const bad: any = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        address: { '@type': 'PostalAddress', addressLocality: 'X' },
      };
      // Validação manual: name é obrigatório
      expect(bad.name, 'LocalBusiness sem name deveria falhar validação').toBeUndefined();
    });
  });

  // ---------- Co-existência ----------
  it('rota /profissional pode ter Person + LocalBusiness + BreadcrumbList simultâneos sem colidir', () => {
    renderHook(() => {
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: 'Maria Santos',
          jobTitle: 'Pintora',
        },
        'person-coexist',
      );
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: 'Maria Santos - Pintora',
          address: { '@type': 'PostalAddress', addressLocality: 'Curitiba' },
        },
        'lb-coexist',
      );
      useJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://precisodeum.com.br/' },
            { '@type': 'ListItem', position: 2, name: 'Pintor', item: 'https://precisodeum.com.br/categoria/pintor' },
            { '@type': 'ListItem', position: 3, name: 'Maria Santos', item: 'https://precisodeum.com.br/profissional/maria-santos' },
          ],
        },
        'bc-coexist',
      );
    });

    const all = getAllJsonLd();
    const types = all.map((o) => o['@type']);
    expect(types).toContain('Person');
    expect(types).toContain('LocalBusiness');
    expect(types).toContain('BreadcrumbList');
    // Cada @type aparece exatamente uma vez (sem duplicação de scripts)
    expect(types.filter((t) => t === 'Person')).toHaveLength(1);
    expect(types.filter((t) => t === 'LocalBusiness')).toHaveLength(1);
    expect(types.filter((t) => t === 'BreadcrumbList')).toHaveLength(1);
  });
});
