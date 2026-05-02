/**
 * wizardTransition · sons + reduced-motion.
 *
 * Garante que:
 *  - playWizardTransition é idempotente dentro do cooldown (220ms).
 *  - Cada kind chama o helper correto de betDopamine.
 *  - prefersReducedMotion responde ao matchMedia.
 *  - phaseTransitionClass devolve '' quando reduced-motion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fieldWin = vi.fn();
const stageWin = vi.fn(async () => {});
const playStampSound = vi.fn();
vi.mock('@/lib/betDopamine', () => ({
  fieldWin: (...a: unknown[]) => fieldWin(...a),
  stageWin: (...a: unknown[]) => stageWin(...a),
  playStampSound: (...a: unknown[]) => playStampSound(...a),
}));

import {
  playWizardTransition,
  prefersReducedMotion,
  phaseTransitionClass,
} from '@/lib/wizardTransition';

beforeEach(() => {
  fieldWin.mockClear();
  stageWin.mockClear();
  playStampSound.mockClear();
  // limpar matchMedia mock
  // @ts-expect-error test-only
  delete window.matchMedia;
});

describe('wizardTransition', () => {
  it('next → fieldWin', async () => {
    playWizardTransition('next');
    expect(fieldWin).toHaveBeenCalled();
  });

  it('back → playStampSound (volume baixo)', async () => {
    playWizardTransition('back');
    expect(playStampSound).toHaveBeenCalled();
  });

  it('skip → playStampSound', async () => {
    playWizardTransition('skip');
    expect(playStampSound).toHaveBeenCalled();
  });

  it('celebrate → stageWin', async () => {
    playWizardTransition('celebrate');
    expect(stageWin).toHaveBeenCalled();
  });

  it('cooldown evita duplo som em <220ms', async () => {
    playWizardTransition('next');
    playWizardTransition('next');
    expect(fieldWin).toHaveBeenCalledTimes(1);
    // após cooldown, dispara de novo
    await new Promise((r) => setTimeout(r, 240));
    playWizardTransition('next');
    expect(fieldWin).toHaveBeenCalledTimes(2);
  });

  it('prefersReducedMotion lê matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    expect(prefersReducedMotion()).toBe(true);
    expect(phaseTransitionClass()).toBe('');
  });

  it('quando NÃO há reduced-motion, classe = animate-fade-in', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    expect(phaseTransitionClass()).toBe('animate-fade-in');
  });

  it('SSR-safe: não quebra sem window.matchMedia', () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(phaseTransitionClass()).toBe('animate-fade-in');
  });
});
