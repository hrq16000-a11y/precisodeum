/**
 * Garante que as rotas /agencia/:slug (RH) e /empresa/:slug (PJ) coexistam
 * sem colisão e apontem para componentes distintos.
 *
 * PR 3 split: rotas foram movidas de src/App.tsx para src/routes/*.tsx.
 * Usamos o helper `readRouterSources()` para ler todas as fontes do router
 * e evitar falsos negativos.
 */
import { describe, it, expect } from 'vitest';
import { readRouterSources } from './helpers/routerSources';

const APP = readRouterSources();

describe('PJ route isolation', () => {
  it('expõe /profissional/:slug → ProviderProfile', () => {
    expect(APP).toMatch(/path="\/profissional\/:slug"\s+element=\{<ProviderProfile/);
  });

  it('expõe /empresa/:slug → CompanyProfile (PJ)', () => {
    expect(APP).toMatch(/path="\/empresa\/:slug"\s+element=\{<CompanyProfile/);
  });

  it('expõe /agencia/:slug → AgencyPublicPage (RH) e NUNCA aponta para CompanyProfile', () => {
    expect(APP).toMatch(/path="\/agencia\/:slug"\s+element=\{<AgencyPublicPage/);
    expect(APP).not.toMatch(/path="\/agencia\/:slug"[^>]*<CompanyProfile/);
  });

  it('rotas /dashboard/agencia (RH) e /dashboard/empresa (PJ) não colidem e usam allowedTypes corretos', () => {
    expect(APP).toMatch(/path="\/dashboard\/agencia"[^>]*allowedTypes=\{\['rh'\]\}/);
    expect(APP).toMatch(/path="\/dashboard\/empresa"[^>]*allowedTypes=\{\['provider'\]\}/);
  });

  it('não existe duplicidade da rota /empresa/:slug', () => {
    const matches = APP.match(/path="\/empresa\/:slug"/g) || [];
    expect(matches.length).toBe(1);
  });
});
