import { describe, expect, it } from 'vitest';
import {
  buildCategoryHref,
  partitionCategories,
  shouldRestrictToCity,
  type CityFilterInput,
} from '@/lib/categoryCityFilter';
import {
  checkLeadRateLimit,
  normalizeEmail,
  normalizePhoneBr,
  recordLeadSubmission,
} from '@/lib/leadAntiSpam';

const cats = [
  { id: 'a', count: 5 },
  { id: 'b', count: 0 },
  { id: 'c', count: 2 },
];

const base = (over: Partial<CityFilterInput> = {}): CityFilterInput => ({
  cityQuery: null,
  scope: undefined,
  loading: false,
  regionalIds: new Set<string>(),
  ...over,
});

describe('/categorias · filtro por cidade', () => {
  it('não restringe sem cidade', () => {
    const r = partitionCategories(cats, base());
    expect(r.restricted).toBe(false);
    expect(r.withProviders.map((c) => c.id)).toEqual(['a', 'c']);
    expect(r.withoutProviders.map((c) => c.id)).toEqual(['b']);
  });

  it('não restringe com texto parcial (< 3 chars)', () => {
    expect(shouldRestrictToCity(base({ cityQuery: 'Cu', scope: 'city', regionalIds: new Set(['a']) }))).toBe(false);
  });

  it('não restringe enquanto a consulta regional carrega', () => {
    const r = partitionCategories(cats, base({ cityQuery: 'Curitiba', loading: true, scope: 'city' }));
    expect(r.restricted).toBe(false);
    expect(r.withProviders.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('não restringe em fallback de estado/global', () => {
    for (const scope of ['state', 'global'] as const) {
      const r = partitionCategories(cats, base({ cityQuery: 'Curitiba', scope, regionalIds: new Set(['a']) }));
      expect(r.restricted).toBe(false);
      expect(r.withProviders.map((c) => c.id)).toEqual(['a', 'c']);
    }
  });

  it('não restringe quando a cidade resolve mas volta vazia', () => {
    const r = partitionCategories(cats, base({ cityQuery: 'Curitiba', scope: 'city', regionalIds: new Set() }));
    expect(r.restricted).toBe(false);
    expect(r.withProviders.length).toBe(2);
  });

  it('restringe apenas com cidade resolvida e resultados', () => {
    const r = partitionCategories(cats, base({ cityQuery: 'Curitiba', scope: 'city', regionalIds: new Set(['c']) }));
    expect(r.restricted).toBe(true);
    expect(r.withProviders.map((c) => c.id)).toEqual(['c']);
  });

  it('nenhuma categoria some da interface em qualquer estado', () => {
    const states: CityFilterInput[] = [
      base(),
      base({ cityQuery: 'Cur', loading: true }),
      base({ cityQuery: 'Curitiba', scope: 'city', regionalIds: new Set(['c']) }),
      base({ cityQuery: 'Curitiba', scope: 'state', regionalIds: new Set(['a']) }),
    ];
    for (const st of states) {
      const r = partitionCategories(cats, st);
      const ids = [...r.withProviders, ...r.withoutProviders].map((c) => c.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    }
  });

  it('preserva cidade e intenção na navegação', () => {
    expect(buildCategoryHref('pintor', { city: 'Curitiba', intent: 'vaga' }))
      .toBe('/categoria/pintor?cidade=Curitiba&intencao=vaga');
    expect(buildCategoryHref('pintor')).toBe('/categoria/pintor');
  });
});

describe('anti-spam de leads', () => {
  it('normaliza telefone brasileiro para E.164 sem +', () => {
    expect(normalizePhoneBr('(41) 99999-8888').value).toBe('5541999998888');
    expect(normalizePhoneBr('+55 41 3333-2222').value).toBe('554133332222');
  });

  it('rejeita telefones inválidos', () => {
    expect(normalizePhoneBr('123').ok).toBe(false);
    expect(normalizePhoneBr('11111111111').reason).toBe('repeated_digits');
    expect(normalizePhoneBr('0299999999').ok).toBe(false);
  });

  it('valida e-mail e bloqueia descartáveis', () => {
    expect(normalizeEmail(' Foo@Bar.com ').value).toBe('foo@bar.com');
    expect(normalizeEmail('foo@bar').ok).toBe(false);
    expect(normalizeEmail('x@mailinator.com').reason).toBe('disposable');
    expect(normalizeEmail('').ok).toBe(true);
    expect(normalizeEmail('', { required: true }).ok).toBe(false);
  });

  it('aplica intervalo mínimo e cota por janela', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const cfg = { windowMs: 600_000, max: 2, minIntervalMs: 20_000 };
    let now = 1_000_000;

    expect(checkLeadRateLimit('k', now, storage, cfg).allowed).toBe(true);
    recordLeadSubmission('k', now, storage, cfg);
    expect(checkLeadRateLimit('k', now + 5_000, storage, cfg).reason).toBe('too_fast');

    now += 30_000;
    expect(checkLeadRateLimit('k', now, storage, cfg).allowed).toBe(true);
    recordLeadSubmission('k', now, storage, cfg);
    expect(checkLeadRateLimit('k', now + 30_000, storage, cfg).reason).toBe('quota');

    // Após a janela expirar, volta a permitir.
    expect(checkLeadRateLimit('k', now + 700_000, storage, cfg).allowed).toBe(true);
  });
});
