/**
 * FASE 1.6.1 — Garante que `runOnboardingSelfHeal` NÃO escreve mais direto em
 * `profiles.onboarding_completed/onboarding_step` e delega 100% ao entrypoint
 * canônico `finalizeOnboarding` (que chama `finalize_onboarding_atomic`).
 *
 * Também trava por leitura estática (regression guard) que:
 *  - selfHeal não tem mais `.from('profiles').update(`
 *  - finalizeOnboarding continua sendo o único a tocar nesses flags
 *  - Phase4Final mantém comentário explicando que `status='active'` NÃO é
 *    bypass (é UX-driven pelo checkbox "Ficar ONLINE").
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Fase 1.6.1 — Remoção de bypasses do finalize canônico', () => {
  it('onboardingSelfHeal delega ao finalizeOnboarding e não escreve flags diretamente', () => {
    const src = read('src/lib/onboardingSelfHeal.ts');
    // delega
    expect(src).toContain("from '@/lib/finalizeOnboarding'");
    expect(src).toContain('finalizeOnboarding({');
    // não escreve mais flags canônicas direto
    expect(src).not.toMatch(/\.update\(\s*\{\s*onboarding_step/);
    expect(src).not.toMatch(/onboarding_completed:\s*true/);
    // sem .from('profiles')
    expect(src).not.toContain(".from('profiles')");
    // telemetria do bypass removido
    expect(src).toContain('finalize_via_self_heal');
  });

  it('finalizeOnboarding continua sendo o entrypoint canônico (RPC atômica)', () => {
    const src = read('src/lib/finalizeOnboarding.ts');
    expect(src).toContain('finalize_onboarding_atomic');
    expect(src).toContain('releaseWizardSessionLock');
    expect(src).toContain('markOnboardingCompletionGrace');
  });

  it('Phase4Final.status=active continua sendo UX-driven com comentário explícito', () => {
    const src = read('src/components/onboarding/wizard/phases/v2/Phase4Final.tsx');
    // o write permanece (escolha do usuário)
    expect(src).toContain("status: 'active'");
    // mas marcado como NÃO bypass
    expect(src).toMatch(/NÃO É BYPASS DO FINALIZE/);
  });

  it('OnboardingV2SuccessPage permanece 100% read-only (sem writes em profiles/providers)', () => {
    const src = read('src/pages/OnboardingV2SuccessPage.tsx');
    expect(src).not.toMatch(/\.from\(['"]profiles['"]\)[\s\S]{0,80}\.update\(/);
    expect(src).not.toMatch(/\.from\(['"]providers['"]\)[\s\S]{0,80}\.update\(/);
    expect(src).not.toMatch(/\.insert\(|\.upsert\(/);
  });
});
