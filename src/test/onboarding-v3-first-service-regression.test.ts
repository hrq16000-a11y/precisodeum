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

  it('Locks já travam nome/WhatsApp/cidade no Phase1Basic', () => {
    const phase = read('src/components/onboarding/wizard/phases/v2/Phase1Basic.tsx');
    expect(phase).toContain('disabled={!!locks?.full_name}');
    expect(phase).toContain('disabled={!!locks?.whatsapp}');
    expect(phase).toContain('disabled={!!locks?.city}');
  });

  it('Skip do 1º serviço mantém o usuário dentro do wizard', () => {
    const shell = read('src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx');
    expect(shell).toContain("source: 'onboarding-v2-skip-first-service'");
    expect(shell).toContain("nextRoute: 'phase4_document'");
    expect(shell).toContain("track('skip', { exit: 'phase4_document' })");
    expect(shell).not.toContain("navigate('/dashboard/servicos')");
  });
});
