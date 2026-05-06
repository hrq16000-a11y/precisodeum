import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do supabase ANTES do import do helper
vi.mock('@/integrations/supabase/client', () => {
  const state: any = { profiles: null, providers: null, levels: null, throwOn: null };
  const make = (table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => {
          if (state.throwOn === table) return Promise.reject(new Error('boom'));
          if (table === 'profiles') return Promise.resolve({ data: state.profiles });
          if (table === 'providers') return Promise.resolve({ data: state.providers });
          if (table === 'gamification_levels') return Promise.resolve({ data: state.levels });
          return Promise.resolve({ data: null });
        },
      }),
    }),
  });
  return {
    supabase: { from: (t: string) => make(t) },
    __state: state,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = await import('@/integrations/supabase/client') as any;
const state = mod.__state;
const { enrichSupportContext, saveSupportContext, consumeSupportContext } = await import('@/lib/supportContext');

beforeEach(() => {
  state.profiles = null;
  state.providers = null;
  state.levels = null;
  state.throwOn = null;
  // sessionStorage shim
  if (typeof globalThis.sessionStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    };
  }
  globalThis.sessionStorage.clear();
});

describe('enrichSupportContext', () => {
  it('preenche snapshot completo com profile + provider + level', async () => {
    state.profiles = { profile_type: 'provider', commercial_plan: 'pro', engagement_points: 1500, level_id: 'lv1' };
    state.providers = { slug: 'joao-silva', plan: 'community' };
    state.levels = { name: 'Diamante' };

    const out = await enrichSupportContext({ source: 'services_limit_reached' }, 'user-1');
    expect(out.profile_snapshot).toEqual({
      profile_slug: 'joao-silva',
      current_plan: 'pro',
      account_level: 'Diamante',
      engagement_points: 1500,
      profile_type: 'provider',
    });
  });

  it('omite campos quando perfil/provider não existem (snapshot só com nulls)', async () => {
    state.profiles = null;
    state.providers = null;
    const out = await enrichSupportContext({ source: 'services_faq_exception' }, 'user-x');
    expect(out.profile_snapshot).toEqual({
      profile_slug: null,
      current_plan: null,
      account_level: null,
      engagement_points: null,
      profile_type: null,
    });
  });

  it('sem userId retorna o ctx original sem snapshot', async () => {
    const out = await enrichSupportContext({ source: 'services_faq_exception' }, null);
    expect(out.profile_snapshot).toBeUndefined();
  });

  it('falha de rede é tolerada (best-effort): devolve ctx original', async () => {
    state.throwOn = 'profiles';
    const out = await enrichSupportContext({ source: 'services_limit_reached' }, 'user-1');
    expect(out.profile_snapshot).toBeUndefined();
    expect(out.source).toBe('services_limit_reached');
  });

  it('cai no plan do provider quando profile.commercial_plan está nulo', async () => {
    state.profiles = { profile_type: 'provider', commercial_plan: null, engagement_points: 0, level_id: null };
    state.providers = { slug: 'maria', plan: 'premium' };
    const out = await enrichSupportContext({ source: 'services_form_category_helper' }, 'user-2');
    expect(out.profile_snapshot?.current_plan).toBe('premium');
    expect(out.profile_snapshot?.account_level).toBeNull();
  });

  it('saveSupportContext + consumeSupportContext fazem round-trip e limpam buffer', () => {
    saveSupportContext({ source: 'services_faq_exception', services_count: 4, cap: 5 });
    const r1 = consumeSupportContext();
    expect(r1?.source).toBe('services_faq_exception');
    expect(r1?.services_count).toBe(4);
    expect(consumeSupportContext()).toBeNull(); // já consumido
  });
});
