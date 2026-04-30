/**
 * telemetryMeta — formato canônico do `meta` enviado em eventos do onboarding.
 *
 * Por que existe:
 *  - Antes, cada caller decidia que campos colocar em `meta`. Isso causava
 *    eventos sem `flow` ou sem `intent`, atrapalhando dashboards.
 *  - Agora há um único formato. O wrapper `trackEvent` do shell garante
 *    `meta.flow`; `trackOnboardingEvent` em `telemetry.ts` injeta `meta.flow`
 *    via sticky sessionStorage como fallback (`'unknown'` quando o caller não
 *    teve passagem pelo shell ainda).
 *
 * Como usar:
 *
 *   import { onboardingMeta } from './telemetryMeta';
 *
 *   void trackEvent({
 *     phase: state.phase,
 *     event: 'next',
 *     userId: user?.id,
 *     meta: onboardingMeta({ field: 'whatsapp', valid: true }),
 *   });
 *
 * Nunca passar PII (nome, whatsapp, documento, email) — apenas contadores,
 * flags, durações e códigos de erro.
 */

import type { OnboardingFlow } from './telemetry';
import type { OnboardingIntent } from './telemetry';

/**
 * Formato canônico do meta. Todos opcionais — `flow` é injetado pelo
 * wrapper/sticky se ausente; `intent` é injetado por sessionStorage.
 */
export interface OnboardingEventMeta {
  /** "company" | "default" | "unknown" — segmenta PJ vs padrão. */
  flow?: OnboardingFlow;
  /** Auto-injetado a partir de PhaseWho. */
  intent?: OnboardingIntent;
  /** Origem do rascunho carregado (none/local/remote/seed). */
  draft_source?: 'none' | 'local' | 'remote' | 'seed';
  /** Tempo gasto na fase em ms — usado por phase_exit. */
  duration_ms?: number;
  /** Código curto de erro (sem PII): 'rls', 'network', 'timeout', etc. */
  error_code?: string;
  /** Tentativa atual desta ação (para detectar loops). */
  attempt?: number;
  /** Ação semântica: 'submit', 'next', 'skip', etc. */
  action?: string;
  /** Campo livre — flags, contadores, IDs de feature. */
  [key: string]: unknown;
}

/**
 * Helper que aceita um meta parcial e retorna ele inalterado, mas tipado.
 * Existe para que callers tenham autocomplete e para servir de "âncora"
 * para futuros lints/grep ("buscar todos os eventos que usam onboardingMeta").
 */
export function onboardingMeta(meta: OnboardingEventMeta = {}): OnboardingEventMeta {
  return meta;
}
