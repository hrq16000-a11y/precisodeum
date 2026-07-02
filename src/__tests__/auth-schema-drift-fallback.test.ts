/**
 * Regressão: se uma coluna referenciada em PROFILE_AUTH_COLUMNS for removida
 * do schema (ex.: account_type, primary_category_id), o useAuth deve refazer
 * a query com select mínimo e NÃO deixar o /cadastro-inicial travado em
 * skeleton.
 *
 * Aqui validamos o contrato do código fonte (schema drift fallback) sem
 * exercitar o React tree completo, que já é coberto por
 * cadastro-inicial-fallback.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

describe('useAuth · schema drift fallback', () => {
  const src = fs.readFileSync('src/hooks/useAuth.tsx', 'utf8');

  it('detecta códigos de erro de coluna inexistente (42703 / PGRST204 / regex)', () => {
    expect(src).toMatch(/code === '42703'/);
    expect(src).toMatch(/code === 'PGRST204'/);
    expect(src).toMatch(/column .\* does not exist/);
  });

  it('refaz query com select mínimo (id, full_name, avatar_url, onboarding_completed)', () => {
    expect(src).toMatch(
      /select\('id, full_name, avatar_url, onboarding_completed'\)\.eq\('id', userId\)\.maybeSingle\(\)/,
    );
  });

  it('logs detalhados com code/details/hint para diagnóstico mobile', () => {
    expect(src).toMatch(/code:.*pErr.*\?\.code.*message:.*pErr\.message.*details/);
  });
});
