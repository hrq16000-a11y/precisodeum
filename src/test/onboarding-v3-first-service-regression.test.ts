import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

/**
 * Após a Fusão Estrutural (Fase B), o handoff Triagem → Criação de Serviço
 * é interno ao WizardShell. Não há mais navegação para /onboarding-v2 nem
 * query string `?source=bet-first-service`.
 */
describe('V3→V2 first service continuity (handoff interno)', () => {
  it('BetModeShell delega o handoff via prop interna (sem navegar para rota legada)', () => {
    const bet = read('src/components/onboarding/wizard/phases/bet/BetModeShell.tsx');
    expect(bet).toContain('onInternalHandoff');
    expect(bet).toContain("goto('pro_document')");
    expect(bet).toContain("state.phase === 'pro_document'");
    expect(bet).toContain("next={() => goto('pro_location')}");
    expect(bet).not.toContain('source=bet-first-service');
    expect(bet).not.toMatch(/navigate\(['"]\/onboarding-v2/);
  });

  it('WizardShell unifica triagem + criação de serviço sem trocar de URL', () => {
    const shell = read('src/components/onboarding/wizard/WizardShell.tsx');
    expect(shell).toContain('BetModeShell');
    expect(shell).toContain('OnboardingV2Shell');
    expect(shell).toContain('internalHandoffFromTriage');
    expect(shell).not.toContain('source=bet-first-service');
  });

  it('OnboardingV2Shell hidrata profile/provider e bloqueia regressão de fase', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).toContain('resolveOnboardingV2SeedState');
    expect(shell).toContain('onboarding-v2-phase-regression-blocked');
    expect(shell).toContain('Já preenchido:');
    expect(shell).not.toContain("searchParams.get('source')");
  });

  it('wizardReducer mantém triage_pro_document na ordem visual do profissional', () => {
    const reducer = read('src/components/onboarding/wizard/wizardReducer.ts');
    expect(reducer).toMatch(/'triage_pro_kind',[\s\S]*'triage_pro_document',[\s\S]*'triage_pro_location'/);
    expect(reducer).toMatch(/'triage_pro_kind',[\s\S]*'triage_pro_document',[\s\S]*'triage_pro_location',[\s\S]*'triage_celebration'/);
  });

  it('limpa drafts da triagem antes da celebração/handoff para não reabrir pro_location', () => {
    const bet = read('src/components/onboarding/wizard/phases/bet/BetModeShell.tsx');
    expect(bet).toMatch(/clearBetDraft\(\);\s*if \(user\?\.id\) await clearRemoteBetDraft\(user\.id\);\s*await addSessionPointsToProfile\(\);\s*await refetchProfile\?\.\(\);\s*goto\('celebration'\);/s);
    expect(bet).toContain('clearBetDraft();');
    expect(bet).toContain('clearRemoteBetDraft(user.id)');
  });

  it('Phase1Basic.tsx foi removido em mai/2026 (consolidação Bet Mode)', () => {
    // O arquivo Phase1Basic e seus 4 componentes (Action/Kind/Location/Contact)
    // foram excluídos porque duplicavam telas já cobertas pela triagem.
    // Os locks de nome/WhatsApp/cidade agora vivem nas fases do Bet Mode.
    expect(exists('src/components/onboarding/wizard/phases/v2/Phase1Basic.tsx')).toBe(false);
  });

  it('Skip do 1º serviço mantém o usuário dentro do wizard', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).toContain("source: 'onboarding-v2-skip-first-service'");
    expect(shell).toContain("nextRoute: 'phase4_document'");
    expect(shell).toContain("dispatch({ type: 'GO_TO', phase: 'phase4_document' })");
    expect(shell).not.toContain("navigate('/onboarding-v2')");
  });
});
