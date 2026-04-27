/**
 * E2E (estático) — "Pular o 1º serviço" no Wizard unificado.
 *
 * Garante:
 *  1. O CTA "Pular" da Phase2Service chama `continueWithoutFirstService`,
 *     que despacha GO_TO phase4_document (NÃO navega ao dashboard).
 *  2. A função `continueWithoutFirstService` registra o log de debug com
 *     nextRoute='phase4_document' e source='onboarding-v2-skip-first-service'.
 *  3. NUNCA volta para fases antigas (phase1_*) após pular.
 *  4. O reducer realmente respeita GO_TO phase4_document a partir de
 *     phase2_service sem regressão para phase1.
 *  5. Os locks do V3 (full_name/whatsapp/city/state/document) são respeitados
 *     pelo bootstrap quando os dados já existem em profile/provider.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import {
  initialOnboardingState,
  onboardingReducer,
  phaseIndex,
} from '@/components/onboarding/onboardingV2/state';
import {
  buildOnboardingCoreLocks,
  buildOnboardingV2BootstrapState,
  resolveOnboardingV2SeedState,
} from '@/components/onboarding/onboardingV2/bootstrap';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('Skip 1º serviço — E2E unificado', () => {
  it('Phase2Service.skip aciona continueWithoutFirstService (não navega ao dashboard)', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    expect(shell).toMatch(/onSkip=\{\(\)\s*=>\s*\{[\s\S]*?continueWithoutFirstService\(\)/);
    expect(shell).not.toMatch(/onSkip=\{\(\)\s*=>\s*navigate\(['"]\/dashboard/);
  });

  it('continueWithoutFirstService loga nextRoute=phase4_document e despacha GO_TO', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    expect(shell).toContain("source: 'onboarding-v2-skip-first-service'");
    expect(shell).toContain("nextRoute: 'phase4_document'");
    expect(shell).toMatch(/dispatch\(\{\s*type:\s*'GO_TO',\s*phase:\s*'phase4_document'\s*\}\)/);
  });

  it('reducer pula direto de phase2_service para phase4_document sem regredir', () => {
    let s = { ...initialOnboardingState, phase: 'phase2_service' as const };
    s = onboardingReducer(s, { type: 'GO_TO', phase: 'phase4_document' });
    expect(s.phase).toBe('phase4_document');
    // não pode estar antes de phase4_document
    expect(phaseIndex(s.phase)).toBeGreaterThanOrEqual(phaseIndex('phase4_document'));
    // e nunca volta para perguntas antigas do V3
    expect(['phase1_action', 'phase1_kind', 'phase1_location', 'phase1_contact'])
      .not.toContain(s.phase);
  });

  it('bootstrap NÃO regride para phase1 quando o V3 já tem identidade completa', () => {
    const profile = {
      full_name: 'Maria Silva',
      whatsapp: '41999998888',
      profile_type: 'provider',
      tax_id: '12345678901',
    };
    const provider = { id: 'p-1', city: 'Curitiba', state: 'PR' };
    const bootstrap = buildOnboardingV2BootstrapState({ profile, provider });
    expect(bootstrap?.phase).toBe('phase2_service');

    // Simula draft já em phase4_document (usuário pulou serviço).
    const draft = {
      phase: 'phase4_document' as const,
      providerId: 'p-1',
      firstServiceId: null,
      profile: { ...initialOnboardingState.profile, ...(bootstrap!.profile as any) },
      service: initialOnboardingState.service,
    };
    const resolved = resolveOnboardingV2SeedState({ draft, bootstrap, source: 'bet-first-service' });
    // Não pode regredir para phase2/phase1.
    expect(phaseIndex(resolved.phase as any)).toBeGreaterThanOrEqual(phaseIndex('phase4_document'));
  });

  it('locks do V3 cobrem nome, WhatsApp, cidade, UF e documento', () => {
    const locks = buildOnboardingCoreLocks({
      profile: { full_name: 'Maria Silva', whatsapp: '41999998888', tax_id: '12345678901' },
      provider: { city: 'Curitiba', state: 'PR' },
    });
    expect(locks.full_name).toBe(true);
    expect(locks.whatsapp).toBe(true);
    expect(locks.city).toBe(true);
    expect(locks.state).toBe(true);
    expect(locks.document).toBe(true);
  });

  it('Phase4Document respeita prop locked e mostra "Já preenchido"', () => {
    const file = read('src/components/onboarding/onboardingV2/Phase4Final.tsx');
    expect(file).toContain('locked?: boolean');
    expect(file).toContain('disabled={!!locked}');
    expect(file).toContain('Já preenchido — não pode ser alterado aqui.');
  });

  it('Shell passa locked=coreLocks.document para Phase4Document e não re-grava se já travado', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    expect(shell).toContain('locked={!!coreLocks.document}');
    expect(shell).toMatch(/if \(!coreLocks\.document\)\s*\{\s*await persistPatch/);
  });
});
