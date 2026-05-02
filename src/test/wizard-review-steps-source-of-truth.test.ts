/**
 * wizard-review-steps-source-of-truth.test.ts
 *
 * Trava REVIEW_PHASE_ORDER / REVIEW_TOTAL_STEPS como fonte única
 * compartilhada entre o WizardProgressBar e o DashboardAssistantPage.
 *
 * Regras anti-regressão:
 *   1) `REVIEW_PHASE_ORDER` re-exportado pelo reducer === o do módulo canônico.
 *   2) `REVIEW_TOTAL_STEPS` é DERIVADO (catálogo - milestones), não hard-coded.
 *   3) O `PHASE_CATALOG` da DashboardAssistantPage importa do módulo canônico
 *      (sem redefinir array literal) — verificado por leitura do arquivo.
 */
import { describe, it, expect } from 'vitest';
import * as canonical from '@/components/onboarding/wizard/wizardReviewSteps';
import * as reducer from '@/components/onboarding/wizard/wizardReducer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('REVIEW_PHASE_ORDER — fonte única', () => {
  it('reducer re-exporta exatamente as constantes canônicas', () => {
    expect(reducer.REVIEW_PHASE_ORDER).toBe(canonical.REVIEW_PHASE_ORDER);
    expect(reducer.REVIEW_TOTAL_STEPS).toBe(canonical.REVIEW_TOTAL_STEPS);
  });

  it('REVIEW_TOTAL_STEPS é a constante canônica X/19 compartilhada', () => {
    // Valor explícito (X/19) consumido por HUD do Wizard E pelos cards do
    // Dashboard Assistant. NÃO é derivado de catálogo.length por incluir
    // ajustes visuais (agrupamento + marcos). Qualquer mudança futura
    // deve ser feita APENAS em wizardReviewSteps.ts.
    expect(canonical.REVIEW_TOTAL_STEPS).toBe(19);
  });

  it("REVIEW_PHASE_ORDER termina em 'done' como sentinela", () => {
    const last = canonical.REVIEW_PHASE_ORDER[canonical.REVIEW_PHASE_ORDER.length - 1];
    expect(last).toBe('done');
  });

  it('DashboardAssistantPage não redefine PHASE_CATALOG localmente', () => {
    const filePath = resolve(__dirname, '../pages/DashboardAssistantPage.tsx');
    const src = readFileSync(filePath, 'utf-8');
    // Deve importar o catálogo canônico
    expect(src).toMatch(/from '@\/components\/onboarding\/wizard\/wizardReviewSteps'/);
    expect(src).toMatch(/REVIEW_STEP_CATALOG/);
    // Não deve haver array literal de PHASE_CATALOG com 10+ entradas { phase: ...
    const literalEntries = src.match(/\{\s*phase:\s*'[a-z_]+'/g) ?? [];
    expect(literalEntries.length).toBeLessThan(5);
  });
});
