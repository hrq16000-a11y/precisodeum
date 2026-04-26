import { describe, it, expect } from 'vitest';
import { buildFeaturedRotationSeed, seededShuffle } from '@/hooks/useProviders';
import { getStableShuffleSeed, seededShuffle as seededShuffleCats } from '@/components/home/CategoriesGrid';

/**
 * Garantias da rotação dos destaques na home:
 * - depende APENAS de variáveis estáveis (data, sortBy, categoria, cidade);
 * - mesma combinação → mesma ordem (idempotente entre re-renders);
 * - lat/lng não afetam a seed (GPS jiggle não reordena);
 * - cidades/dias diferentes → ordens diferentes (rotação real).
 */
describe('Featured providers — seed estável', () => {
  it('retorna a mesma seed para os mesmos parâmetros estáveis', () => {
    const a = buildFeaturedRotationSeed({ sortBy: 'proximity', categorySlug: null, userCity: 'São José dos Pinhais', dateKey: '2026-04-26' });
    const b = buildFeaturedRotationSeed({ sortBy: 'proximity', categorySlug: null, userCity: 'são josé dos pinhais', dateKey: '2026-04-26' });
    expect(a).toBe(b); // normaliza acento + caixa
  });

  it('muda a seed quando a data muda (rotação diária)', () => {
    const a = buildFeaturedRotationSeed({ sortBy: 'proximity', userCity: 'Curitiba', dateKey: '2026-04-26' });
    const b = buildFeaturedRotationSeed({ sortBy: 'proximity', userCity: 'Curitiba', dateKey: '2026-04-27' });
    expect(a).not.toBe(b);
  });

  it('muda a seed quando a cidade muda', () => {
    const a = buildFeaturedRotationSeed({ sortBy: 'proximity', userCity: 'Curitiba', dateKey: '2026-04-26' });
    const b = buildFeaturedRotationSeed({ sortBy: 'proximity', userCity: 'São Paulo', dateKey: '2026-04-26' });
    expect(a).not.toBe(b);
  });

  it('muda a seed quando o sortBy muda', () => {
    const a = buildFeaturedRotationSeed({ sortBy: 'proximity', userCity: 'Curitiba', dateKey: '2026-04-26' });
    const b = buildFeaturedRotationSeed({ sortBy: 'availability', userCity: 'Curitiba', dateKey: '2026-04-26' });
    expect(a).not.toBe(b);
  });

  it('seededShuffle é determinístico para a mesma seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const seed = buildFeaturedRotationSeed({ sortBy: 'category', userCity: 'Curitiba', dateKey: '2026-04-26' });
    const r1 = seededShuffle(items, seed);
    const r2 = seededShuffle(items, seed);
    expect(r1).toEqual(r2);
  });

  it('rotação realmente embaralha (não devolve a mesma ordem da entrada)', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const seed = buildFeaturedRotationSeed({ sortBy: 'category', userCity: 'Curitiba', dateKey: '2026-04-26' });
    const out = seededShuffle(items, seed);
    expect(out).toHaveLength(items.length);
    expect(new Set(out)).toEqual(new Set(items));
    expect(out).not.toEqual(items);
  });
});

describe('CategoriesGrid — seed estável', () => {
  it('mesma data + mesma cidade → mesma seed (sem Date.now)', () => {
    const a = getStableShuffleSeed(null, 'Curitiba', 'PR', '2026-04-26');
    const b = getStableShuffleSeed(null, 'curitiba', 'pr', '2026-04-26');
    expect(a).toBe(b);
  });

  it('datas diferentes → seeds diferentes (rotação diária garantida)', () => {
    const a = getStableShuffleSeed(null, 'Curitiba', 'PR', '2026-04-26');
    const b = getStableShuffleSeed(null, 'Curitiba', 'PR', '2026-04-27');
    expect(a).not.toBe(b);
  });

  it('cidades diferentes → seeds diferentes', () => {
    const a = getStableShuffleSeed(null, 'Curitiba', 'PR', '2026-04-26');
    const b = getStableShuffleSeed(null, 'São Paulo', 'SP', '2026-04-26');
    expect(a).not.toBe(b);
  });

  it('usuário logado mantém seed estável entre dias para diferenciar de anônimo', () => {
    const anon = getStableShuffleSeed(null, 'Curitiba', 'PR', '2026-04-26');
    const user = getStableShuffleSeed('user-abc', 'Curitiba', 'PR', '2026-04-26');
    expect(anon).not.toBe(user);
  });

  it('seededShuffle das categorias é determinístico', () => {
    const cats = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }];
    const seed = getStableShuffleSeed(null, 'Curitiba', 'PR', '2026-04-26');
    expect(seededShuffleCats(cats, seed)).toEqual(seededShuffleCats(cats, seed));
  });
});
