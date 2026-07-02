import { describe, it, expect } from 'vitest';
import {
  applySearchFilters,
  countActiveFilters,
  initialFilterState,
  type FilterableProvider,
} from '@/lib/searchFilters';

const mk = (overrides: Partial<FilterableProvider> & Pick<FilterableProvider, 'id' | 'userId'>): FilterableProvider => ({
  name: 'Provider',
  businessName: undefined,
  neighborhood: '',
  phone: '',
  whatsapp: '',
  featured: false,
  rating: 0,
  reviewCount: 0,
  yearsExperience: 0,
  ...overrides,
});

const sample: FilterableProvider[] = [
  mk({ id: '1', userId: 'u1', name: 'Ana', whatsapp: '11999990000', rating: 4.8, reviewCount: 50, distanceKm: 5, featured: true }),
  mk({ id: '2', userId: 'u2', name: 'Bruno', whatsapp: '', phone: '1133334444', rating: 4.2, reviewCount: 20, distanceKm: 2 }),
  mk({ id: '3', userId: 'u3', name: 'Carla', whatsapp: '11888880000', rating: 3.9, reviewCount: 100, distanceKm: 10, featured: true }),
  mk({ id: '4', userId: 'u4', name: 'Diego', whatsapp: '   ', rating: 5.0, reviewCount: 5, distanceKm: 1 }),
];

describe('applySearchFilters', () => {
  it('retorna lista original quando nenhum filtro está ativo', () => {
    expect(applySearchFilters(sample)).toHaveLength(4);
  });

  describe('toggle "Aceitando clientes" (acceptingOnly)', () => {
    it('mantém apenas profissionais com WhatsApp não-vazio', () => {
      const result = applySearchFilters(sample, { acceptingOnly: true });
      expect(result.map((p) => p.id)).toEqual(['1', '3']);
    });

    it('exclui profissionais com WhatsApp em branco/whitespace', () => {
      const result = applySearchFilters(sample, { acceptingOnly: true });
      expect(result.find((p) => p.id === '4')).toBeUndefined();
      expect(result.find((p) => p.id === '2')).toBeUndefined();
    });

    it('quando OFF, mantém todos independentemente do WhatsApp', () => {
      expect(applySearchFilters(sample, { acceptingOnly: false })).toHaveLength(4);
    });
  });

  describe('toggle "Online agora" (onlineOnly)', () => {
    it('mantém apenas usuários presentes no onlineSet', () => {
      const onlineSet = new Set(['u1', 'u3']);
      const result = applySearchFilters(sample, { onlineOnly: true, onlineSet });
      expect(result.map((p) => p.id).sort()).toEqual(['1', '3']);
    });

    it('retorna lista vazia se onlineSet está vazio', () => {
      const result = applySearchFilters(sample, { onlineOnly: true, onlineSet: new Set() });
      expect(result).toHaveLength(0);
    });

    it('quando OFF, ignora onlineSet completamente', () => {
      const onlineSet = new Set(['u1']);
      expect(applySearchFilters(sample, { onlineOnly: false, onlineSet })).toHaveLength(4);
    });
  });

  describe('combinação dos toggles', () => {
    it('aplica AND entre acceptingOnly e onlineOnly', () => {
      const onlineSet = new Set(['u1', 'u2']); // u2 não tem whatsapp
      const result = applySearchFilters(sample, { acceptingOnly: true, onlineOnly: true, onlineSet });
      expect(result.map((p) => p.id)).toEqual(['1']);
    });
  });

  describe('ordenação', () => {
    it('sortBy=nearest ordena ascendente por distanceKm', () => {
      const result = applySearchFilters(sample, { sortBy: 'nearest' });
      expect(result.map((p) => p.id)).toEqual(['4', '2', '1', '3']);
    });

    it('sortBy=rating ordena descendente por nota', () => {
      const result = applySearchFilters(sample, { sortBy: 'rating' });
      expect(result[0].id).toBe('4');
      expect(result.at(-1)?.id).toBe('3');
    });

    it('sortBy=relevance preserva ordem original', () => {
      const result = applySearchFilters(sample, { sortBy: 'relevance' });
      expect(result.map((p) => p.id)).toEqual(['1', '2', '3', '4']);
    });
  });

  describe('urgencyMode', () => {
    it('coloca usuários online primeiro mantendo o restante', () => {
      const onlineSet = new Set(['u3']);
      const result = applySearchFilters(sample, { urgencyMode: true, onlineSet });
      expect(result[0].id).toBe('3');
      expect(result).toHaveLength(4);
    });

    it('é no-op quando onlineSet está vazio', () => {
      const result = applySearchFilters(sample, { urgencyMode: true, onlineSet: new Set() });
      expect(result.map((p) => p.id)).toEqual(['1', '2', '3', '4']);
    });
  });
});

describe('countActiveFilters', () => {
  it('retorna 0 para o estado inicial', () => {
    expect(countActiveFilters(initialFilterState)).toBe(0);
  });

  it('conta cada toggle de disponibilidade', () => {
    expect(countActiveFilters({ ...initialFilterState, onlineOnly: true })).toBe(1);
    expect(countActiveFilters({ ...initialFilterState, acceptingOnly: true })).toBe(1);
    expect(countActiveFilters({ ...initialFilterState, onlineOnly: true, acceptingOnly: true })).toBe(2);
  });

  it('soma toggles + filtros textuais + minRating + featured', () => {
    expect(
      countActiveFilters({
        selectedCategory: 'eletricista',
        selectedNeighborhood: 'centro',
        businessNameFilter: 'acme',
        phoneFilter: '',
        featuredFilter: 'featured',
        minRating: 4,
        onlineOnly: true,
        acceptingOnly: true,
      })
    ).toBe(7);
  });

  it('featuredFilter=all não conta', () => {
    expect(countActiveFilters({ ...initialFilterState, featuredFilter: 'all' })).toBe(0);
  });

  it('minRating=0 não conta', () => {
    expect(countActiveFilters({ ...initialFilterState, minRating: 0 })).toBe(0);
  });
});

describe('clearAllFilters (simulado via initialFilterState)', () => {
  it('initialFilterState zera todos os campos contáveis', () => {
    expect(countActiveFilters(initialFilterState)).toBe(0);
    expect(initialFilterState.onlineOnly).toBe(false);
    expect(initialFilterState.acceptingOnly).toBe(false);
    expect(initialFilterState.sortBy).toBe('relevance');
    expect(initialFilterState.featuredFilter).toBe('all');
    expect(initialFilterState.minRating).toBe(0);
  });
});
