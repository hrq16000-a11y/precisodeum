/**
 * WizardProgressBar — shimmer + acessibilidade (prefers-reduced-motion).
 *
 * Garante que:
 *  - Quando `prefers-reduced-motion: reduce` está ativo, o shimmer NÃO é
 *    renderizado mesmo com `anchored=true`.
 *  - Em motion normal, o shimmer aparece e some sozinho após ~240ms.
 *  - O shimmer usa CSS animation (composited transform), não anima `x`
 *    via framer — isso evita reflow contínuo da barra.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { WizardProgressBar } from '@/components/onboarding/wizard/WizardProgressBar';

// Hoisted mock: framer-motion devolve `motion.div` minimal e
// `useReducedMotion` controlado por flag.
let prefersReduced = false;
vi.mock('framer-motion', () => ({
  motion: { div: (props: any) => <div {...props} /> },
  useReducedMotion: () => prefersReduced,
}));

const renderBar = (props: Partial<Parameters<typeof WizardProgressBar>[0]> = {}) =>
  render(
    <WizardProgressBar
      phase={'main_service' as any}
      totalOverride={19}
      anchored
      {...props}
    />,
  );

describe('WizardProgressBar — shimmer & reduced motion', () => {
  beforeEach(() => {
    prefersReduced = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza shimmer quando anchored=true e motion habilitado', () => {
    renderBar({ anchored: true });
    expect(screen.getByTestId('wizard-progress-shimmer')).toBeInTheDocument();
  });

  it('NÃO renderiza shimmer quando prefers-reduced-motion=reduce', () => {
    prefersReduced = true;
    renderBar({ anchored: true });
    expect(screen.queryByTestId('wizard-progress-shimmer')).toBeNull();
  });

  it('shimmer some após 240ms (timer one-shot)', () => {
    renderBar({ anchored: true });
    expect(screen.getByTestId('wizard-progress-shimmer')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(screen.queryByTestId('wizard-progress-shimmer')).toBeNull();
  });

  it('NÃO renderiza shimmer quando anchored=false', () => {
    renderBar({ anchored: false });
    expect(screen.queryByTestId('wizard-progress-shimmer')).toBeNull();
  });

  it('expõe atributo data-anchored no progressbar para CSS/teste', () => {
    renderBar({ anchored: true });
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('data-anchored')).toBe('true');
  });
});
