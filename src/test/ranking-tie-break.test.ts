import { describe, it, expect } from 'vitest';
import {
  compareProviders,
  normalizeDistance,
  sortProvidersStable,
  type RankableProvider,
} from '@/lib/rankingTieBreak';

describe('normalizeDistance (Online Boost v3 — paridade com RPC nearby_providers)', () => {
  it('returns 0 for null/undefined/NaN — não derruba a consulta sem GPS', () => {
    expect(normalizeDistance(null)).toBe(0);
    expect(normalizeDistance(undefined)).toBe(0);
    expect(normalizeDistance(NaN)).toBe(0);
  });

  it('returns 1 for distance <= 0 (mesma localização)', () => {
    expect(normalizeDistance(0)).toBe(1);
    expect(normalizeDistance(-100)).toBe(1);
  });

  it('returns 0 when distance is at or beyond max radius', () => {
    expect(normalizeDistance(50000, 50000)).toBe(0);
    expect(normalizeDistance(99999, 50000)).toBe(0);
  });

  it('linearly interpolates within bounds', () => {
    expect(normalizeDistance(25000, 50000)).toBeCloseTo(0.5, 5);
    expect(normalizeDistance(10000, 50000)).toBeCloseTo(0.8, 5);
  });

  it('respects custom maxM', () => {
    expect(normalizeDistance(5000, 10000)).toBeCloseTo(0.5, 5);
  });
});

describe('compareProviders — tie-break determinístico', () => {
  const base: RankableProvider = {
    user_id: 'u1',
    level_priority: 1,
    visibility_score: 0.5,
    engagement_points: 100,
    rating_avg: 4.5,
    review_count: 10,
    distance_m: 1000,
    updated_at: '2025-01-01T00:00:00Z',
  };

  it('ranks higher level_priority first (Online/Featured wins)', () => {
    const a = { ...base, level_priority: 2 };
    const b = { ...base, level_priority: 1 };
    expect(compareProviders(a, b)).toBeLessThan(0);
  });

  it('falls back to visibility_score when level_priority ties', () => {
    const a = { ...base, visibility_score: 0.9 };
    const b = { ...base, visibility_score: 0.4 };
    expect(compareProviders(a, b)).toBeLessThan(0);
  });

  it('uses engagement_points as 3rd tie-breaker', () => {
    const a = { ...base, engagement_points: 500 };
    const b = { ...base, engagement_points: 100 };
    expect(compareProviders(a, b)).toBeLessThan(0);
  });

  it('uses rating_avg, then review_count', () => {
    const a = { ...base, rating_avg: 5 };
    const b = { ...base, rating_avg: 4 };
    expect(compareProviders(a, b)).toBeLessThan(0);

    const c = { ...base, review_count: 50 };
    const d = { ...base, review_count: 10 };
    expect(compareProviders(c, d)).toBeLessThan(0);
  });

  it('treats null distance as +Infinity (sem GPS perde para com GPS, mas não quebra)', () => {
    const withGps = { ...base, distance_m: 5000 };
    const noGps = { ...base, user_id: 'u2', distance_m: null };
    expect(compareProviders(withGps, noGps)).toBeLessThan(0);
  });

  it('handles two null distances stably via updated_at then user_id', () => {
    const a = { ...base, user_id: 'aaa', distance_m: null };
    const b = { ...base, user_id: 'bbb', distance_m: null };
    expect(compareProviders(a, b)).toBeLessThan(0);
  });

  it('final tie-break uses user_id string compare — 100% determinístico', () => {
    const a = { ...base, user_id: 'aaa' };
    const b = { ...base, user_id: 'zzz' };
    expect(compareProviders(a, b)).toBeLessThan(0);
    // simétrico
    expect(compareProviders(b, a)).toBeGreaterThan(0);
  });

  it('é totalmente reflexivo para o mesmo provider', () => {
    expect(compareProviders(base, { ...base })).toBe(0);
  });
});

describe('sortProvidersStable — ordenação completa de listas', () => {
  it('ordena por critérios em cascata mantendo estabilidade em empates múltiplos', () => {
    const list: RankableProvider[] = [
      { user_id: 'd', level_priority: 1, visibility_score: 0.3, distance_m: null },
      { user_id: 'a', level_priority: 2, visibility_score: 0.9, distance_m: 5000 },
      { user_id: 'c', level_priority: 1, visibility_score: 0.3, distance_m: 2000 },
      { user_id: 'b', level_priority: 2, visibility_score: 0.9, distance_m: 1000 },
    ];
    const sorted = sortProvidersStable(list).map((p) => p.user_id);
    // 'b' antes de 'a' (mesmo level/score, b mais perto)
    // depois 'c' antes de 'd' (c tem distancia, d é null)
    expect(sorted).toEqual(['b', 'a', 'c', 'd']);
  });

  it('todos null/empate completo — estável e determinístico via user_id', () => {
    const list: RankableProvider[] = [
      { user_id: 'z' },
      { user_id: 'a' },
      { user_id: 'm' },
    ];
    expect(sortProvidersStable(list).map((p) => p.user_id)).toEqual(['a', 'm', 'z']);
  });

  it('não muta o array original', () => {
    const list: RankableProvider[] = [
      { user_id: 'a', visibility_score: 0.1 },
      { user_id: 'b', visibility_score: 0.9 },
    ];
    const snapshot = list.map((p) => p.user_id);
    sortProvidersStable(list);
    expect(list.map((p) => p.user_id)).toEqual(snapshot);
  });
});

describe('Ranking v3.1 — empates múltiplos extremos (regressões)', () => {
  it('vários providers com mesmo score+rating+reviews — desempata por distância e id', () => {
    const list: RankableProvider[] = [
      { user_id: 'p3', level_priority: 1, visibility_score: 0.5, engagement_points: 100, rating_avg: 4.8, review_count: 20, distance_m: null },
      { user_id: 'p1', level_priority: 1, visibility_score: 0.5, engagement_points: 100, rating_avg: 4.8, review_count: 20, distance_m: 800 },
      { user_id: 'p2', level_priority: 1, visibility_score: 0.5, engagement_points: 100, rating_avg: 4.8, review_count: 20, distance_m: 800 },
      { user_id: 'p4', level_priority: 1, visibility_score: 0.5, engagement_points: 100, rating_avg: 4.8, review_count: 20, distance_m: null },
    ];
    const order = sortProvidersStable(list).map((p) => p.user_id);
    // p1/p2 (com GPS) antes de p3/p4 (null); dentro do empate, user_id asc
    expect(order).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('todos com distance_m null + ratings idênticos — ordena exclusivamente por user_id', () => {
    const list: RankableProvider[] = [
      { user_id: 'zeta', level_priority: 1, visibility_score: 0.4, rating_avg: 5, review_count: 100, distance_m: null },
      { user_id: 'alfa', level_priority: 1, visibility_score: 0.4, rating_avg: 5, review_count: 100, distance_m: null },
      { user_id: 'beta', level_priority: 1, visibility_score: 0.4, rating_avg: 5, review_count: 100, distance_m: null },
    ];
    expect(sortProvidersStable(list).map((p) => p.user_id)).toEqual(['alfa', 'beta', 'zeta']);
  });

  it('updated_at antigo desempata antes do user_id quando todos os critérios numéricos empatam', () => {
    const a: RankableProvider = { user_id: 'zzz', visibility_score: 0.5, distance_m: 1000, updated_at: '2024-01-01T00:00:00Z' };
    const b: RankableProvider = { user_id: 'aaa', visibility_score: 0.5, distance_m: 1000, updated_at: '2026-01-01T00:00:00Z' };
    // a (mais antigo) vence apesar do user_id maior
    expect(compareProviders(a, b)).toBeLessThan(0);
  });

  it('empate absoluto (mesmas chaves, sem updated_at) — comparator é simétrico', () => {
    const a: RankableProvider = { user_id: 'xx', visibility_score: 0.7, rating_avg: 4.2 };
    const b: RankableProvider = { user_id: 'yy', visibility_score: 0.7, rating_avg: 4.2 };
    expect(Math.sign(compareProviders(a, b))).toBe(-Math.sign(compareProviders(b, a)));
  });

  it('lista grande com ratings iguais e distâncias mistas mantém ordem determinística entre runs', () => {
    const make = (id: string, dist: number | null): RankableProvider => ({
      user_id: id, level_priority: 1, visibility_score: 0.5, engagement_points: 200,
      rating_avg: 4.5, review_count: 30, distance_m: dist,
    });
    const list: RankableProvider[] = [
      make('e', null), make('a', 500), make('d', null), make('b', 500), make('c', 1500),
    ];
    const a = sortProvidersStable(list).map((p) => p.user_id);
    const b = sortProvidersStable([...list].reverse()).map((p) => p.user_id);
    expect(a).toEqual(b); // determinístico independente da ordem de entrada
    expect(a).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('engagement_points elevado supera distância menor', () => {
    const longeRico: RankableProvider = { user_id: 'r', visibility_score: 0.5, engagement_points: 900, distance_m: 9000 };
    const pertoPobre: RankableProvider = { user_id: 'p', visibility_score: 0.5, engagement_points: 100, distance_m: 500 };
    expect(compareProviders(longeRico, pertoPobre)).toBeLessThan(0);
  });
});

