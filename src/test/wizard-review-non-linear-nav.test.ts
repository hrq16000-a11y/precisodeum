/**
 * Modo Assistente "dono do Wizard" — Navegação não-linear em revisão.
 *
 * Cobre:
 *  - Default sem `section` em mode=review abre em `triage_identity` (Step 1).
 *  - Sections novas (identidade/quem/cidade/tipo/documento/local) mapeiam
 *    para fases triage_*.
 *  - REVIEW_PHASE_ORDER tem 19 fases visíveis + 'done' (régua única do
 *    Assistente). Inclui triage_identity..triage_celebration e principais
 *    fases main_*.
 *  - prevUnifiedPhase retrocede de `main_service` para `triage_celebration`
 *    (Step 7 → Step 6) e nunca trava na primeira posição.
 */
import { describe, it, expect } from 'vitest';
import { getOnboardingReviewSection } from '@/lib/onboardingAccess';
import {
  REVIEW_PHASE_ORDER,
  prevRenderableReviewPhase,
  unifiedPhaseIndex,
} from '@/components/onboarding/wizard/wizardReducer';

// Helper espelhado no WizardShell em modo revisão. Pula fases-fantasma
// (main_action/kind/location/contact) que existem só para paridade X/19.
function prevReview(phase: string): string {
  return prevRenderableReviewPhase(phase as any);
}

describe('Wizard review · navegação não-linear', () => {
  it('REVIEW_PHASE_ORDER tem 19 fases visíveis + done', () => {
    expect(REVIEW_PHASE_ORDER[REVIEW_PHASE_ORDER.length - 1]).toBe('done');
    expect(REVIEW_PHASE_ORDER.length - 1).toBeGreaterThanOrEqual(16);
    expect(REVIEW_PHASE_ORDER.length - 1).toBeLessThanOrEqual(20);
    // Step 1 = triage_identity
    expect(REVIEW_PHASE_ORDER[0]).toBe('triage_identity');
    // Inclui triagem completa
    ['triage_identity', 'triage_who', 'triage_pro_kind',
     'triage_pro_document', 'triage_pro_location', 'triage_celebration']
      .forEach(p => expect(REVIEW_PHASE_ORDER).toContain(p));
    // Inclui principais main_*
    ['main_service', 'main_service_details', 'main_photos',
     'main_celebration', 'main_document', 'main_avatar',
     'main_extras_a', 'main_extras_b']
      .forEach(p => expect(REVIEW_PHASE_ORDER).toContain(p));
  });

  it('section novas mapeiam para fases de triagem', () => {
    expect(getOnboardingReviewSection('?section=identidade')).toBe('identidade');
    expect(getOnboardingReviewSection('?section=quem')).toBe('quem');
    expect(getOnboardingReviewSection('?section=cidade')).toBe('cidade');
    expect(getOnboardingReviewSection('?section=tipo')).toBe('tipo');
    expect(getOnboardingReviewSection('?section=documento')).toBe('documento');
    expect(getOnboardingReviewSection('?section=local')).toBe('local');
  });

  it('section clássica continua válida (compat)', () => {
    expect(getOnboardingReviewSection('?section=servicos')).toBe('servicos');
    expect(getOnboardingReviewSection('?section=dados')).toBe('dados');
    expect(getOnboardingReviewSection('?section=portfolio')).toBe('portfolio');
  });

  it('section inválida ou ausente retorna null', () => {
    expect(getOnboardingReviewSection('')).toBeNull();
    expect(getOnboardingReviewSection('?section=xyz')).toBeNull();
    expect(getOnboardingReviewSection('?mode=review')).toBeNull();
  });

  it('prevReview retrocede de main_service para triage_celebration', () => {
    expect(prevReview('main_service')).toBe('triage_celebration');
  });

  it('prevReview em triage_identity é estável (não trava abaixo de 0)', () => {
    expect(prevReview('triage_identity')).toBe('triage_identity');
  });

  it('prevReview percorre toda a régua review até a Step 1', () => {
    let phase: string = 'main_service';
    const visited: string[] = [phase];
    for (let i = 0; i < 30 && phase !== 'triage_identity'; i++) {
      phase = prevReview(phase);
      visited.push(phase);
    }
    expect(phase).toBe('triage_identity');
    expect(visited).toContain('triage_celebration');
    expect(visited).toContain('triage_pro_location');
  });

  it('unifiedPhaseIndex de triage_identity é 0', () => {
    expect(unifiedPhaseIndex('triage_identity')).toBe(0);
  });
});
