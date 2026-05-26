/**
 * Testes puros da Central Operacional de Onboarding.
 * Não testa renderização React — apenas as funções puras de
 * cálculo (completion rate + hotspot score), que são as
 * unidades de risco da página.
 */
import { describe, it, expect } from 'vitest';
import { computeCompletionRate, computeHotspotScore } from '@/pages/admin/AdminOnboardingOpsPage';

describe('computeCompletionRate', () => {
  it('retorna 0 quando enters é 0', () => {
    expect(computeCompletionRate(0, 0)).toBe(0);
    expect(computeCompletionRate(0, 50)).toBe(0);
  });
  it('calcula a razão completes/enters', () => {
    expect(computeCompletionRate(100, 25)).toBeCloseTo(0.25);
    expect(computeCompletionRate(10, 10)).toBe(1);
  });
  it('clampa em [0,1]', () => {
    expect(computeCompletionRate(10, 999)).toBe(1);
    expect(computeCompletionRate(10, -5)).toBe(0);
  });
  it('lida com enters negativo de forma defensiva', () => {
    expect(computeCompletionRate(-5, 10)).toBe(0);
  });
});

describe('computeHotspotScore', () => {
  const baseRow = {
    phase: 'p',
    enters: 0,
    exits: 0,
    completes: 0,
    abandons: 0,
    refreshes: 0,
    recoveries: 0,
    validation_failed: 0,
    autosave_failed: 0,
    regressions: 0,
    unique_sessions: 0,
    unique_users: 0,
  };

  it('pondera autosave_failed mais forte que recoveries', () => {
    const a = computeHotspotScore({ ...baseRow, autosave_failed: 1 });
    const b = computeHotspotScore({ ...baseRow, recoveries: 1 });
    expect(a).toBeGreaterThan(b);
  });

  it('soma todas as métricas com seus pesos corretos', () => {
    const score = computeHotspotScore({
      ...baseRow,
      recoveries: 2,        // 6
      validation_failed: 3, // 6
      autosave_failed: 1,   // 4
      refreshes: 5,         // 5
      abandons: 2,          // 4
    });
    expect(score).toBe(25);
  });

  it('zera quando todas métricas são zero', () => {
    expect(computeHotspotScore(baseRow)).toBe(0);
  });

  it('refresh tem peso menor que abandono', () => {
    const r = computeHotspotScore({ ...baseRow, refreshes: 1 });
    const a = computeHotspotScore({ ...baseRow, abandons: 1 });
    expect(a).toBeGreaterThan(r);
  });
});
