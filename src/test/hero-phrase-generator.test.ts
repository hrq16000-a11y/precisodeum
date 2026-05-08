import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildPhrase,
  inferGender,
  articleFor,
  pickNextOrder,
  normalizeCategory,
  RECENT_HISTORY_KEY,
  DEFAULT_HISTORY_SIZE,
} from '@/lib/heroPhraseGenerator';

class MemStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
  key() { return null; }
  length = 0;
}

describe('heroPhraseGenerator · gênero e contração', () => {
  it('infere masculino para terminações típicas', () => {
    expect(inferGender('pintor')).toBe('m');
    expect(inferGender('encanador')).toBe('m');
    expect(inferGender('pedreiro')).toBe('m');
    expect(inferGender('arquiteto')).toBe('m');
    expect(inferGender('designer gráfico')).toBe('m');
  });

  it('infere feminino para terminações típicas', () => {
    expect(inferGender('costureira')).toBe('f');
    expect(inferGender('decoração')).toBe('f');
    expect(inferGender('limpeza')).toBe('f');
  });

  it('respeita overrides irregulares (eletricista=m, babá=f)', () => {
    expect(inferGender('eletricista')).toBe('m');
    expect(inferGender('dentista')).toBe('m');
    expect(inferGender('babá')).toBe('f');
    expect(inferGender('manicure')).toBe('f');
  });

  it('articleFor mapeia gênero → artigo indefinido', () => {
    expect(articleFor('m')).toBe('um');
    expect(articleFor('f')).toBe('uma');
  });

  it('buildPhrase("need") gera "Preciso de um/uma X" sem "!"', () => {
    const p = buildPhrase({ slug: 'pintor', label: 'pintor' }, 'need');
    expect(p.text).toBe('Preciso de um pintor');
    expect(p.isCallout).toBe(false);
    expect(p.category.gender).toBe('m');

    const f = buildPhrase({ slug: 'baba', label: 'babá' }, 'need');
    expect(f.text).toBe('Preciso de uma babá');
  });

  it('buildPhrase("find") gera "Encontre um/uma X!" com callout', () => {
    const p = buildPhrase({ slug: 'eletricista', label: 'eletricista' }, 'find');
    expect(p.text).toBe('Encontre um eletricista!');
    expect(p.isCallout).toBe(true);
  });

  it('não usa contração inválida (de+um permanece "de um")', () => {
    const p = buildPhrase({ slug: 'baba', label: 'babá' }, 'need');
    expect(p.prefix).toBe('Preciso de uma');
    expect(p.text).not.toMatch(/dum|duma|do |da /);
  });

  it('normalizeCategory respeita gender explícito mesmo contra heurística', () => {
    const c = normalizeCategory({ slug: 'manicure', label: 'manicure', gender: 'f' });
    expect(c.gender).toBe('f');
    expect(c.article).toBe('uma');
  });
});

describe('heroPhraseGenerator · anti-repetição (cooldown)', () => {
  let storage: MemStorage;
  beforeEach(() => { storage = new MemStorage(); });

  const POOL = [
    { slug: 'a', label: 'a' },
    { slug: 'b', label: 'b' },
    { slug: 'c', label: 'c' },
    { slug: 'd', label: 'd' },
    { slug: 'e', label: 'e' },
  ];

  it('evita repetir slugs presentes na janela recente', () => {
    const seedHistory = ['a', 'b'];
    const { order } = pickNextOrder(POOL, {
      storage: storage as unknown as Storage,
      random: () => 0,
      seedHistory,
    });
    // 'a' e 'b' vão para o cooldown tail (final), elegíveis vêm primeiro
    const head = order.slice(0, 3).map((c) => c.slug);
    expect(head).not.toContain('a');
    expect(head).not.toContain('b');
  });

  it('libera o item mais antigo quando cooldown deixaria <2 elegíveis', () => {
    const allButOne = ['a', 'b', 'c', 'd']; // só sobraria 'e'
    const { order } = pickNextOrder(POOL, {
      storage: storage as unknown as Storage,
      random: () => 0,
      seedHistory: allButOne,
    });
    // O algoritmo libera 'd' (último da janela) → elegíveis: e, d
    const head = order.slice(0, 2).map((c) => c.slug);
    expect(head.length).toBe(2);
    expect(head).toContain('e');
  });

  it('nextHistory contém todos os slugs sem duplicatas, limitado por historySize', () => {
    const { nextHistory } = pickNextOrder(POOL, {
      storage: storage as unknown as Storage,
      random: () => 0,
      seedHistory: ['x', 'y'],
      historySize: 4,
    });
    expect(nextHistory.length).toBeLessThanOrEqual(4);
    expect(new Set(nextHistory).size).toBe(nextHistory.length);
  });

  it('lê histórico do storage quando seedHistory ausente', () => {
    storage.setItem(RECENT_HISTORY_KEY, JSON.stringify(['a', 'b']));
    const { order } = pickNextOrder(POOL, {
      storage: storage as unknown as Storage,
      random: () => 0,
    });
    const head = order.slice(0, 3).map((c) => c.slug);
    expect(head).not.toContain('a');
    expect(head).not.toContain('b');
  });

  it('retorna ordem vazia para pool vazio sem quebrar', () => {
    const r = pickNextOrder([], { storage: storage as unknown as Storage });
    expect(r.order).toEqual([]);
  });

  it('todas as categorias retornadas têm gênero+artigo normalizados', () => {
    const { order } = pickNextOrder(
      [{ slug: 'baba', label: 'babá', gender: 'f' }, { slug: 'p', label: 'pintor' }],
      { storage: storage as unknown as Storage, random: () => 0 },
    );
    for (const c of order) {
      expect(c.gender === 'm' || c.gender === 'f').toBe(true);
      expect(c.article === 'um' || c.article === 'uma').toBe(true);
    }
  });

  it('respeita historySize default e não cresce indefinidamente', () => {
    let history: string[] = [];
    for (let i = 0; i < 20; i++) {
      const { nextHistory } = pickNextOrder(POOL, {
        storage: storage as unknown as Storage,
        random: () => Math.random(),
        seedHistory: history,
      });
      history = nextHistory;
      expect(history.length).toBeLessThanOrEqual(DEFAULT_HISTORY_SIZE);
    }
  });
});
