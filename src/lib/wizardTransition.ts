/**
 * wizardTransition — efeitos sonoros + animação curta consistentes por
 * AÇÃO de navegação (next/back/skip/celebrate). Reaproveita betDopamine.
 *
 * Regras:
 *  - Respeita `prefers-reduced-motion: reduce` (silencia animação CSS;
 *    sons só tocam se o usuário já interagiu — getCtx() guarda isso).
 *  - Idempotente: chamar 2× rápido NÃO multiplica o som.
 *  - SSR-safe: noop se `window` indefinido.
 */

import { fieldWin, stageWin, playStampSound } from './betDopamine';

const COOLDOWN_MS = 220;
let lastPlayedAt = 0;

function withinCooldown(): boolean {
  const now = Date.now();
  if (now - lastPlayedAt < COOLDOWN_MS) return true;
  lastPlayedAt = now;
  return false;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export type WizardTransitionKind = 'next' | 'back' | 'skip' | 'celebrate' | 'milestone';

/**
 * Toca o som apropriado para a ação de navegação. Não bloqueia.
 */
export function playWizardTransition(kind: WizardTransitionKind): void {
  if (typeof window === 'undefined') return;
  if (withinCooldown()) return;
  try {
    switch (kind) {
      case 'next':
      case 'milestone':
        fieldWin();
        break;
      case 'celebrate':
        // confete + 2 moedas + brasão
        void stageWin('normal');
        break;
      case 'skip':
        // som leve, sem confete — usuário escolheu pular
        playStampSound(0.12);
        break;
      case 'back':
        // som muito sutil; alguns usuários acham irritante voltar com fanfarra
        playStampSound(0.08);
        break;
    }
  } catch {
    /* noop — áudio nunca pode quebrar navegação */
  }
}

/**
 * Classe utilitária para uma micro-animação de troca de fase.
 * Aplicada na DIV de wrapper da fase corrente (key={phase} já força remount).
 */
export function phaseTransitionClass(): string {
  if (prefersReducedMotion()) return '';
  return 'animate-fade-in';
}
