/**
 * Behavioral telemetry helper · wrapper anti-vazamento + throttle
 *
 * Camada opt-in: este helper NÃO é chamado pelo wizard ainda. Existe para que
 * adoção futura seja incremental e segura (sanitiza meta + throttle por chave).
 *
 * Política:
 *  - Nunca grava texto digitado, senha, documento, email, whatsapp, endereço.
 *  - Apenas IDs e métricas comportamentais (tempo, contagem, fase, field-name).
 */
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';
import {
  BEHAVIORAL_EVENTS,
  createThrottleState,
  sanitizeBehavioralMeta,
  shouldEmitBehavioral,
  type BehavioralEvent,
  type BehavioralMeta,
  type ThrottleState,
} from '@/lib/onboarding/behavioralFunnel';

const STATE: ThrottleState = createThrottleState();

function isBehavioralEvent(e: string): e is BehavioralEvent {
  return (BEHAVIORAL_EVENTS as readonly string[]).includes(e);
}

export interface TrackBehavioralOptions {
  event: BehavioralEvent;
  phase?: OnboardingPhase;
  field?: string;
  meta?: BehavioralMeta;
  userId?: string | null;
  /** Override do throttle (ms). Default 2000. */
  minIntervalMs?: number;
  /** Para testes — injeta now() determinístico. */
  now?: number;
  /** Para testes — injeta estado de throttle externo. */
  throttleState?: ThrottleState;
}

/** Envia evento comportamental se passar pelo throttle e estiver no catálogo. */
export async function trackBehavioral(opts: TrackBehavioralOptions): Promise<boolean> {
  if (!isBehavioralEvent(opts.event)) return false;

  const state = opts.throttleState ?? STATE;
  const nowMs = opts.now ?? Date.now();
  const key = `${opts.event}:${opts.phase ?? '_'}:${opts.field ?? '_'}`;
  if (!shouldEmitBehavioral(state, key, nowMs, opts.minIntervalMs)) return false;

  const cleanMeta = sanitizeBehavioralMeta({
    ...(opts.meta ?? {}),
    ...(opts.field ? { field: opts.field } : {}),
  });

  try {
    await trackOnboardingEvent({
      phase: opts.phase ?? ('phase2_service' as OnboardingPhase),
      event: opts.event,
      userId: opts.userId ?? null,
      meta: { ...cleanMeta, behavioral: true },
    });
    return true;
  } catch {
    // fail-soft: telemetria nunca quebra runtime
    return false;
  }
}
