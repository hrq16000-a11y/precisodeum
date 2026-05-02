/**
 * wizard-review-anchor-and-labels.test.ts
 *
 * Cobre as 3 melhorias da consolidação da régua de revisão:
 *
 *   1) Fonte única: WizardShell e WizardProgressBar consomem
 *      `REVIEW_PHASE_ORDER` / `REVIEW_TOTAL_STEPS` / helpers diretamente do
 *      módulo `wizardReviewSteps` (não mais via re-export do reducer).
 *
 *   2) UNIFIED_PHASE_LABELS blindado: `resolveUnifiedPhaseLabel` jamais
 *      retorna string vazia, mesmo para fase desconhecida ou label vazio.
 *
 *   3) Telemetria de âncora: `useReviewAnchor` emite evento
 *      `review_anchor_used` quando a fase atual é "fantasma" e a UI cai na
 *      última fase renderável visitada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock telemetry ANTES de importar o hook
const trackOnboardingEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent,
  setOnboardingIntent: vi.fn(),
  getOnboardingIntent: vi.fn(() => null),
}));

import { useReviewAnchor, resolveUnifiedPhaseLabel } from '@/components/onboarding/wizard/useReviewAnchor';
import { UNIFIED_PHASE_LABELS, type UnifiedPhase } from '@/components/onboarding/wizard/wizardReducer';

beforeEach(() => {
  trackOnboardingEvent.mockClear();
});

describe('Fonte única — WizardShell/ProgressBar consomem wizardReviewSteps', () => {
  const wizardShellSrc = readFileSync(
    resolve(__dirname, '../components/onboarding/wizard/WizardShell.tsx'),
    'utf-8',
  );
  const progressBarSrc = readFileSync(
    resolve(__dirname, '../components/onboarding/wizard/WizardProgressBar.tsx'),
    'utf-8',
  );

  it('WizardShell importa REVIEW_* helpers de wizardReviewSteps', () => {
    expect(wizardShellSrc).toMatch(
      /from '\.\/wizardReviewSteps'/,
    );
    // Não deve mais importar essas constantes do reducer
    const reducerImportBlock = wizardShellSrc.match(
      /from '\.\/wizardReducer';/g,
    );
    expect(reducerImportBlock).toBeTruthy();
    // Garantia: REVIEW_PHASE_ORDER não aparece dentro do bloco de import
    // do reducer (deveria vir de wizardReviewSteps).
    const reducerImport = wizardShellSrc
      .split("from './wizardReducer'")[0]
      .split('import {')
      .pop() ?? '';
    expect(reducerImport).not.toMatch(/REVIEW_PHASE_ORDER/);
    expect(reducerImport).not.toMatch(/REVIEW_TOTAL_STEPS/);
    expect(reducerImport).not.toMatch(/nextRenderableReviewPhase/);
  });

  it('WizardProgressBar importa REVIEW_TOTAL_STEPS de wizardReviewSteps', () => {
    expect(progressBarSrc).toMatch(/from '\.\/wizardReviewSteps'/);
  });

  it('WizardProgressBar usa resolveUnifiedPhaseLabel (sem fallback de string vazia)', () => {
    expect(progressBarSrc).toMatch(/resolveUnifiedPhaseLabel/);
    // Anti-regressão: barra NÃO pode mais ter `?? ''` para label.
    expect(progressBarSrc).not.toMatch(/UNIFIED_PHASE_LABELS\[phase\]\s*\?\?\s*''/);
  });
});

describe('resolveUnifiedPhaseLabel — invariante de label não-vazio', () => {
  it('retorna label do mapa quando definido', () => {
    expect(resolveUnifiedPhaseLabel(UNIFIED_PHASE_LABELS, 'triage_identity'))
      .toBe(UNIFIED_PHASE_LABELS['triage_identity']);
  });

  it('cai em fallback para fase desconhecida (nunca string vazia)', () => {
    const out = resolveUnifiedPhaseLabel(
      UNIFIED_PHASE_LABELS,
      'phase_inexistente' as UnifiedPhase,
    );
    expect(out).toBe('Etapa em revisão');
    expect(out.length).toBeGreaterThan(0);
  });

  it('cai em fallback quando o label é string vazia ou só espaços', () => {
    const map = { triage_identity: '   ' } as Partial<Record<UnifiedPhase, string>>;
    expect(resolveUnifiedPhaseLabel(map, 'triage_identity')).toBe('Etapa em revisão');
  });

  it('UNIFIED_PHASE_LABELS não tem nenhum valor vazio (defesa em profundidade)', () => {
    for (const [k, v] of Object.entries(UNIFIED_PHASE_LABELS)) {
      expect(v.trim().length, `label vazio para ${k}`).toBeGreaterThan(0);
    }
  });
});

describe('useReviewAnchor — telemetria de fase fantasma', () => {
  it('NÃO ancora quando isReview=false (fora de revisão)', () => {
    const { result } = renderHook(
      ({ phase }) => useReviewAnchor(phase, false),
      { initialProps: { phase: 'main_action' as UnifiedPhase } },
    );
    expect(result.current.isAnchored).toBe(false);
    expect(result.current.anchorPhase).toBe('main_action');
    expect(trackOnboardingEvent).not.toHaveBeenCalled();
  });

  it('NÃO ancora quando a fase atual é renderável', () => {
    const { result } = renderHook(
      ({ phase }) => useReviewAnchor(phase, true),
      { initialProps: { phase: 'triage_identity' as UnifiedPhase } },
    );
    expect(result.current.isAnchored).toBe(false);
    expect(result.current.anchorPhase).toBe('triage_identity');
    expect(trackOnboardingEvent).not.toHaveBeenCalled();
  });

  it('ANCORA na última fase renderável quando entra em fase fantasma e emite telemetria 1x', async () => {
    const { result, rerender } = renderHook(
      ({ phase }) => useReviewAnchor(phase, true),
      { initialProps: { phase: 'triage_pro_location' as UnifiedPhase } },
    );
    expect(result.current.anchorPhase).toBe('triage_pro_location');
    expect(trackOnboardingEvent).not.toHaveBeenCalled();

    // Atravessa fase-fantasma: deve ancorar e emitir telemetria
    await act(async () => {
      rerender({ phase: 'main_action' as UnifiedPhase });
    });
    expect(result.current.isAnchored).toBe(true);
    expect(result.current.anchorPhase).toBe('triage_pro_location');
    expect(trackOnboardingEvent).toHaveBeenCalledTimes(1);
    expect(trackOnboardingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'review_anchor_used',
        phase: 'triage_pro_location',
        meta: expect.objectContaining({
          ghost_phase: 'main_action',
          anchor_phase: 'triage_pro_location',
        }),
      }),
    );

    // Re-renderizar com a MESMA fase-fantasma não deve emitir de novo
    await act(async () => {
      rerender({ phase: 'main_action' as UnifiedPhase });
    });
    expect(trackOnboardingEvent).toHaveBeenCalledTimes(1);
  });

  it('emite telemetria de novo se a phase fantasma muda', async () => {
    const { rerender } = renderHook(
      ({ phase }) => useReviewAnchor(phase, true),
      { initialProps: { phase: 'triage_pro_location' as UnifiedPhase } },
    );
    await act(async () => {
      rerender({ phase: 'main_action' as UnifiedPhase });
    });
    await act(async () => {
      rerender({ phase: 'main_kind' as UnifiedPhase });
    });
    expect(trackOnboardingEvent).toHaveBeenCalledTimes(2);
  });
});
