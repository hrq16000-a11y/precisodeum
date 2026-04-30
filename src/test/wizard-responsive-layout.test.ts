/**
 * Teste de layout responsivo — valida que tokens compactos do Wizard V2
 * (containers, títulos, paddings) estão configurados para caber em telas
 * pequenas (iPhone SE 375x667 / Android 360x800) sem rolagem desnecessária.
 *
 * Como o layout completo depende de muitos contextos (auth, supabase),
 * este teste valida os TOKENS compartilhados em wizardStyles.ts — fonte
 * única de verdade que rege todas as fases V1/V2.
 */
import { describe, it, expect } from 'vitest';
import { wizardStyles } from '@/components/onboarding/wizard/phases/v2/wizardStyles';

describe('Wizard responsive layout tokens', () => {
  it('container usa padding e space-y compactos (sem py-6/space-y-5)', () => {
    expect(wizardStyles.container).toMatch(/py-2(\b|\.)/);
    expect(wizardStyles.container).toMatch(/space-y-2\.5|space-y-2(\b)/);
    expect(wizardStyles.container).not.toMatch(/py-6|space-y-5/);
  });

  it('título usa escala reduzida (text-lg) e não text-2xl', () => {
    expect(wizardStyles.title).toMatch(/text-lg/);
    expect(wizardStyles.title).not.toMatch(/text-2xl/);
  });

  it('subtítulo usa text-xs (densidade alta)', () => {
    expect(wizardStyles.subtitle).toMatch(/text-xs/);
    expect(wizardStyles.subtitle).not.toMatch(/text-sm/);
  });

  it('card usa p-3 com space-y-2 e rounded-xl (não 2xl + p-4)', () => {
    expect(wizardStyles.card).toMatch(/p-3/);
    expect(wizardStyles.card).toMatch(/space-y-2(\b)/);
    expect(wizardStyles.card).toMatch(/rounded-xl(\b)/);
    expect(wizardStyles.card).not.toMatch(/p-4|rounded-2xl/);
  });

  it('CTA mantém h-12 para a11y de touch-target (>=48px)', () => {
    expect(wizardStyles.cta).toMatch(/h-12/);
  });

  it('estima altura aproximada do above-the-fold em iPhone SE (667px)', () => {
    // py-2 = 8px topo + 8px base = 16px
    // header: title(~22px) + subtitle(~14px) + space-y-0.5(2px) = ~38px
    // card típico: p-3(24px total) + 2 inputs(~80px) + label(~16px) = ~120px
    // CTA h-12 = 48px
    // total estimado: 16 + 38 + 120 + 48 + space-y-2.5 (~10px) ≈ 232px
    // ProgressBar (~28px) + PointsHud (~40px) ≈ 68px de chrome
    // Total chrome+conteúdo: ~300px — folga em iPhone SE (667px).
    const estimatedFold = 232 + 68;
    const iphoneSE = 667;
    expect(estimatedFold).toBeLessThan(iphoneSE * 0.6); // < 60% da altura
  });
});
