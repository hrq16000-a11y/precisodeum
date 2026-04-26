import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('V3 first service continuity', () => {
  it('uses a dedicated source flag from cadastro-bet to onboarding-v2', () => {
    const bet = read('src/components/onboarding/betMode/BetModeShell.tsx');
    expect(bet).toContain('/onboarding-v2?source=bet-first-service');
  });

  it('hydrates onboarding-v2 from saved profile/provider data and blocks phase regression', () => {
    const shell = read('src/components/onboarding/onboardingV2/OnboardingV2Shell.tsx');
    expect(shell).toContain('resolveOnboardingV2SeedState');
    expect(shell).toContain('onboarding-v2-phase-regression-blocked');
    expect(shell).toContain('Já preenchido:');
  });

  it('locks already-filled core fields instead of asking everything again', () => {
    const phase = read('src/components/onboarding/onboardingV2/Phase1Basic.tsx');
    expect(phase).toContain('disabled={!!locks?.full_name}');
    expect(phase).toContain('disabled={!!locks?.whatsapp}');
    expect(phase).toContain('disabled={!!locks?.city}');
  });
});
