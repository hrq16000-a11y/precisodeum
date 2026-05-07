/**
 * Wizard — sugestão progressiva de cidade/bairro mesmo com GPS negado.
 *
 * Cobre via inspeção estática (compatível com a suite vitest existente):
 *  1. PhaseClientCity solicita GPS no mount mas não bloqueia se negado.
 *  2. O effect de auto-fill é progressivo: preenche city/state/neighborhood vazios
 *     a partir de geo (cache/IP/GPS) — não condiciona a geo.source === 'gps'.
 *  3. Renderiza microtexto/tooltip "Sugerimos sua cidade/bairro automaticamente
 *     — confirme ou edite quando quiser." quando a sugestão veio do auto-fill.
 *  4. PhaseProLocation aplica a mesma lógica progressiva (userEditedRef).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CITY = readFileSync(
  resolve(__dirname, '../components/onboarding/wizard/phases/bet/PhaseClientCity.tsx'),
  'utf8',
);
const PRO_LOCATION = readFileSync(
  resolve(__dirname, '../components/onboarding/wizard/phases/bet/PhaseProLocation.tsx'),
  'utf8',
);

describe('Wizard — sugestão progressiva de cidade/bairro (IP/GPS)', () => {
  it('PhaseClientCity solicita GPS no mount mas trata negação silenciosamente', () => {
    expect(CITY).toMatch(/requestPreciseLocation\(\{ force: true \}\)/);
    // .catch(() => undefined) garante que falha não quebra a UX
    expect(CITY).toMatch(/\.catch\(\(\) => undefined\)/);
  });

  it('Auto-fill é progressivo (não condiciona a geo.source === "gps")', () => {
    // Effect dispara quando QUALQUER campo geo está disponível
    expect(CITY).toMatch(/if \(!geo\.city && !geo\.state && !geo\.neighborhood\) return/);
    // Não exige source === 'gps' como pré-requisito do preenchimento
    expect(CITY).not.toMatch(/if \(geo\.source !== 'gps'\) return/);
  });

  it('Renderiza microtexto orientando que cidade/bairro foram sugeridos', () => {
    expect(CITY).toMatch(/data-testid="autofill-hint"/);
    expect(CITY).toMatch(/Sugerimos sua cidade.*automaticamente/);
    expect(CITY).toMatch(/Sugerimos seu bairro automaticamente/);
    expect(CITY).toMatch(/confirme ou edite quando quiser/);
    expect(CITY).toMatch(/role="status"/);
    expect(CITY).toMatch(/aria-live="polite"/);
  });

  it('userEditedRef bloqueia overwrite após edição manual (city + neighborhood)', () => {
    // Manual edit no neighborhood marca como editado
    expect(CITY).toMatch(/userEditedRef\.current = true; patch\(\{ neighborhood:/);
    // Effect respeita esse flag
    expect(CITY).toMatch(/if \(userEditedRef\.current\) return/);
  });

  it('PhaseProLocation aplica a mesma lógica progressiva (userEditedRef)', () => {
    expect(PRO_LOCATION).toMatch(/userEditedRef/);
    // Não condiciona o auto-fill a aceitação de GPS
    expect(PRO_LOCATION).toMatch(/auto-fill.*progressive|progressivo/i);
  });
});
