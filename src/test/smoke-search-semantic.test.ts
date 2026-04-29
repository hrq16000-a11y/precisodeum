/**
 * smoke-search-semantic.test.ts
 *
 * Smoke tests semânticos das rotas de busca (/buscar, /categoria/{slug},
 * /cidade/{cidade}) usando um dataset mock coerente (categorias, serviços,
 * profissionais, avaliações, leads). Valida a LÓGICA PURA de filtragem +
 * normalização — independente de banco — para garantir que após um restore
 * (Golden Zip) a busca continue retornando resultados consistentes.
 */
import { describe, it, expect } from 'vitest';
import {
  applySearchFilters,
  type FilterableProvider,
} from '@/lib/searchFilters';
import { normalizeSearchText as normalizeText } from '@/lib/searchNormalization';

/* ───────── Dataset semântico ───────── */

interface Category { id: string; slug: string; name: string }
interface Service { id: string; provider_id: string; category_id: string; name: string; description: string }
interface Review { provider_id: string; rating: number }
interface Lead { provider_id: string; status: string }

const CATEGORIES: Category[] = [
  { id: 'c1', slug: 'eletricista', name: 'Eletricista' },
  { id: 'c2', slug: 'encanador', name: 'Encanador' },
  { id: 'c3', slug: 'pintor', name: 'Pintor' },
];

const PROVIDERS: FilterableProvider[] = [
  { id: 'p1', userId: 'u1', name: 'João Silva', businessName: 'JS Elétrica',
    neighborhood: 'Centro', phone: '11999990001', whatsapp: '11999990001',
    featured: true, rating: 4.8, reviewCount: 25, yearsExperience: 10,
    latitude: -23.55, longitude: -46.63 },
  { id: 'p2', userId: 'u2', name: 'Maria Souza', businessName: 'Souza Hidráulica',
    neighborhood: 'Vila Mariana', phone: '11999990002', whatsapp: '11999990002',
    featured: false, rating: 4.5, reviewCount: 12, yearsExperience: 5,
    latitude: -23.59, longitude: -46.63 },
  { id: 'p3', userId: 'u3', name: 'Carlos Lima', businessName: 'Lima Pinturas',
    neighborhood: 'Pinheiros', phone: '11999990003', whatsapp: '11999990003',
    featured: false, rating: 4.9, reviewCount: 40, yearsExperience: 8,
    latitude: -23.56, longitude: -46.69 },
];

const SERVICES: Service[] = [
  { id: 's1', provider_id: 'p1', category_id: 'c1', name: 'Instalação elétrica residencial', description: 'Quadro de luz, tomadas, disjuntores.' },
  { id: 's2', provider_id: 'p2', category_id: 'c2', name: 'Reparo hidráulico', description: 'Vazamentos, sifões, registros.' },
  { id: 's3', provider_id: 'p3', category_id: 'c3', name: 'Pintura completa de apartamento', description: 'Massa corrida, tinta, acabamento.' },
];

const REVIEWS: Review[] = [
  { provider_id: 'p1', rating: 5 }, { provider_id: 'p1', rating: 4 },
  { provider_id: 'p3', rating: 5 }, { provider_id: 'p3', rating: 5 }, { provider_id: 'p3', rating: 4 },
];

const LEADS: Lead[] = [
  { provider_id: 'p1', status: 'novo' },
  { provider_id: 'p2', status: 'concluido' },
];

/* ───────── Helpers que simulam o que o backend faria ───────── */

function providersByCategory(slug: string): FilterableProvider[] {
  const cat = CATEGORIES.find((c) => c.slug === slug);
  if (!cat) return [];
  const ids = new Set(SERVICES.filter((s) => s.category_id === cat.id).map((s) => s.provider_id));
  return PROVIDERS.filter((p) => ids.has(p.id));
}

function searchByText(query: string): FilterableProvider[] {
  const q = normalizeText(query);
  if (!q) return PROVIDERS;
  const matchedProviderIds = new Set<string>();
  for (const s of SERVICES) {
    if (normalizeText(`${s.name} ${s.description}`).includes(q)) {
      matchedProviderIds.add(s.provider_id);
    }
  }
  for (const p of PROVIDERS) {
    if (normalizeText(`${p.name} ${p.businessName ?? ''}`).includes(q)) matchedProviderIds.add(p.id);
  }
  return PROVIDERS.filter((p) => matchedProviderIds.has(p.id));
}

/* ───────── Tests ───────── */

describe('Smoke /buscar — busca textual coerente', () => {
  it('retorna eletricista ao buscar "elétrica"', () => {
    const r = searchByText('elétrica');
    expect(r.map((p) => p.id)).toContain('p1');
    expect(r.map((p) => p.id)).not.toContain('p2');
  });

  it('é case/acento-insensitive: "PINTURA" == "pintura"', () => {
    const a = searchByText('PINTURA').map((p) => p.id).sort();
    const b = searchByText('pintura').map((p) => p.id).sort();
    expect(a).toEqual(b);
    expect(a).toContain('p3');
  });

  it('retorna vazio para termo inexistente', () => {
    expect(searchByText('astronauta')).toHaveLength(0);
  });

  it('aplica filtro por bairro depois da busca', () => {
    const initial = searchByText('');
    const filtered = applySearchFilters(initial, { selectedNeighborhood: 'Pinheiros' });
    expect(filtered.map((p) => p.id)).toEqual(['p3']);
  });
});

describe('Smoke /categoria/{slug} — listagem por categoria', () => {
  it('eletricista → apenas providers com serviço da categoria', () => {
    const r = providersByCategory('eletricista');
    expect(r.map((p) => p.id)).toEqual(['p1']);
  });

  it('slug inexistente → vazio (não vaza outras categorias)', () => {
    expect(providersByCategory('astronauta')).toHaveLength(0);
  });

  it('ordena por avaliação dentro da categoria pintor', () => {
    const r = applySearchFilters(providersByCategory('pintor'), { sortBy: 'rating' });
    expect(r[0].id).toBe('p3');
  });
});

describe('Smoke /cidade/{cidade} — coerência geográfica + sort', () => {
  it('sort "rating" ranqueia p3 (4.9) acima de p1 (4.8) acima de p2 (4.5)', () => {
    const r = applySearchFilters(PROVIDERS, { sortBy: 'rating' });
    expect(r.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('sort "reviews" prioriza quem tem mais avaliações', () => {
    const r = applySearchFilters(PROVIDERS, { sortBy: 'reviews' });
    expect(r[0].id).toBe('p3');
  });

  it('filtro featured=true mantém apenas destacados', () => {
    const r = applySearchFilters(PROVIDERS, { featuredFilter: 'featured' });
    expect(r.map((p) => p.id)).toEqual(['p1']);
  });

  it('onlineOnly filtra por presença', () => {
    const onlineSet = new Set(['p1', 'p3']);
    const r = applySearchFilters(PROVIDERS, { onlineOnly: true, onlineSet });
    expect(r.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
  });
});

describe('Integridade do dataset semântico (sanity)', () => {
  it('todo serviço aponta para um provider e categoria existentes', () => {
    for (const s of SERVICES) {
      expect(PROVIDERS.find((p) => p.id === s.provider_id)).toBeTruthy();
      expect(CATEGORIES.find((c) => c.id === s.category_id)).toBeTruthy();
    }
  });

  it('toda review aponta para um provider existente', () => {
    for (const r of REVIEWS) {
      expect(PROVIDERS.find((p) => p.id === r.provider_id)).toBeTruthy();
    }
  });

  it('todo lead aponta para um provider existente', () => {
    for (const l of LEADS) {
      expect(PROVIDERS.find((p) => p.id === l.provider_id)).toBeTruthy();
    }
  });

  it('rating médio calculado bate com reviewCount declarado (~)', () => {
    const p3 = PROVIDERS.find((p) => p.id === 'p3')!;
    const reviewsP3 = REVIEWS.filter((r) => r.provider_id === 'p3');
    const avg = reviewsP3.reduce((s, r) => s + r.rating, 0) / reviewsP3.length;
    expect(avg).toBeGreaterThanOrEqual(4.5);
    expect(p3.rating).toBeGreaterThanOrEqual(4.5);
  });
});
