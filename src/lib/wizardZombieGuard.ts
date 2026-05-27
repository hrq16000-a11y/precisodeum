/**
 * Wizard Zombie Guard — instrumentação preventiva para timers.
 *
 * Objetivo:
 *  - Detectar (em produção) callbacks de `setTimeout` que disparam DEPOIS
 *    do usuário já ter trocado de fase do wizard. Esse padrão é típico de
 *    timer zumbi: cleanup esquecido, navegação acelerada, ou desmonte
 *    sem clearTimeout.
 *
 * Como funciona:
 *  - `setActiveWizardPhase(phase)` é chamado pelo Shell sempre que a fase
 *    ativa muda. Mantém um contador monotônico de "épocas" de fase.
 *  - `scheduleWizardTimeout({ phase, action }, fn, delay)` agenda um
 *    setTimeout amarrado à época atual. Quando o callback dispara:
 *      • se a época da fase ainda for a mesma, executa normalmente;
 *      • se mudou, registra `event: 'error' / error_code: 'zombie_timer'`
 *        em onboarding_events com `phase_at_schedule`, `phase_at_fire`,
 *        `delay_ms`, `lag_ms` e `action` — sem PII — e NÃO executa o fn
 *        (comportamento conservador: timer zumbi não deve afetar UI).
 *
 * Fail-soft: nunca lança. Se a telemetria falhar, o agendamento ainda
 * funciona como `window.setTimeout` normal.
 */

import {
  trackOnboardingEvent,
  type OnboardingEventName,
} from '@/components/onboarding/wizard/phases/v2/telemetry';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

let activePhase: string | null = null;
let phaseEpoch = 0;
let phaseChangedAt = 0;

export function setActiveWizardPhase(phase: string | null | undefined): void {
  const next = phase ? String(phase) : null;
  if (next === activePhase) return;
  activePhase = next;
  phaseEpoch += 1;
  phaseChangedAt = Date.now();
}

export function getActiveWizardPhase(): string | null {
  return activePhase;
}

/**
 * Invalida TODOS os timers pendentes agendados via `scheduleWizardTimeout`
 * sem precisar de seus handles. Bumpa a época do guard — qualquer callback
 * que disparar depois será detectado como zumbi e (default) suprimido.
 *
 * Caso de uso principal: transição entre shells (BetModeShell →
 * OnboardingV2Shell). Chamado pelo shell que monta para "neutralizar"
 * qualquer timer remanescente do shell anterior antes de iniciar seus
 * próprios efeitos.
 */
export function neutralizeZombieTimers(): void {
  phaseEpoch += 1;
  phaseChangedAt = Date.now();
}

export interface ScheduleOptions {
  /** Fase em que o timer foi agendado (não obrigatório, mas recomendado). */
  phase?: OnboardingPhase | string | null;
  /** Rótulo curto da ação (ex.: 'transition_next', 'copy_reset'). */
  action: string;
  /** Se true, executa o callback mesmo após troca de fase (apenas registra). */
  runIfStale?: boolean;
}

/**
 * Agenda um setTimeout instrumentado. Retorna o handle (igual a window.setTimeout)
 * — pode ser passado diretamente para `window.clearTimeout`.
 */
export function scheduleWizardTimeout(
  opts: ScheduleOptions,
  fn: () => void,
  delay: number,
): number {
  if (typeof window === 'undefined') return 0;
  const epochAtSchedule = phaseEpoch;
  const phaseAtSchedule = opts.phase ? String(opts.phase) : activePhase;
  const scheduledAt = Date.now();

  return window.setTimeout(() => {
    const stale = epochAtSchedule !== phaseEpoch;
    if (stale) {
      // Detecção: timer disparou após troca de fase.
      try {
        void trackOnboardingEvent({
          phase: (phaseAtSchedule ?? 'unknown') as OnboardingPhase,
          event: 'error' as OnboardingEventName,
          meta: {
            error_code: 'zombie_timer',
            error_message: 'wizard timer fired after phase change',
            action: opts.action,
            phase_at_schedule: phaseAtSchedule,
            phase_at_fire: activePhase,
            delay_ms: delay,
            lag_ms: Math.max(0, Date.now() - scheduledAt - delay),
            phase_changed_ago_ms: Math.max(0, Date.now() - phaseChangedAt),
          },
        });
      } catch { /* fail-soft */ }
      // Em dev, deixa rastro no console para facilitar debug local.
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[wizardZombieGuard] zombie timer detected', {
          action: opts.action,
          phase_at_schedule: phaseAtSchedule,
          phase_at_fire: activePhase,
          delay_ms: delay,
        });
      }
      if (!opts.runIfStale) return;
    }
    try {
      fn();
    } catch (err) {
      // Não engolir silenciosamente — relança em dev para visibilidade.
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[wizardZombieGuard] callback error', err);
      }
    }
  }, delay) as unknown as number;
}

/** Limpa contadores — uso em testes. */
export function __resetWizardZombieGuard(): void {
  activePhase = null;
  phaseEpoch = 0;
  phaseChangedAt = 0;
}
