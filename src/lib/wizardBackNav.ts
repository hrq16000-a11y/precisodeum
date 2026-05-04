/**
 * wizardBackNav — fonte ÚNICA da navegação "Voltar" do WizardShell.
 *
 * Por que existe:
 *  - Antes, cada fase tinha seu próprio onBack (uns dispatch direto, outros
 *    noop, outros disparando custom events com nomes diferentes). Quando o
 *    Voltar quebrava, era impossível diagnosticar onde a chain falhou.
 *  - Esta helper centraliza:
 *      1) telemetria com `code` canônico (`WIZARD_BACK_*`),
 *      2) o nome do CustomEvent unificado (`wizard:request-prev-unified`),
 *      3) um guard de fallback que dispara `wizard:request-back` quando
 *         o listener primário não estiver presente.
 *
 *  - Use SEMPRE `requestWizardBack({ phase, source })` no onBack das fases.
 */
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import { makeBackEventId } from '@/lib/wizardBackOrchestrator';

export const WIZARD_BACK_EVENTS = {
  /** Evento principal: tratado pelo WizardShell (régua unificada / revisão). */
  PREV_UNIFIED: 'wizard:request-prev-unified',
  /** Fallback histórico: alguns orquestradores ainda escutam isto. */
  REQUEST_BACK: 'wizard:request-back',
} as const;

export const WIZARD_BACK_CODES = {
  CLICK: 'wizard_back:click',
  DISPATCHED: 'wizard_back:dispatched',
  GUARD_FALLBACK: 'wizard_back:guard_fallback',
  NOOP_REDIRECTED: 'wizard_back:noop_redirected',
} as const;

export type WizardBackSource =
  | 'phase2_service'
  | 'phase2_details'
  | 'phase4_document'
  | 'phase4_extras_a'
  | 'phase4_extras_b'
  | 'main_more_services'
  | 'step20_more_services'
  | 'step21_portfolio'
  | 'step22_review'
  | 'error_modal'
  | 'error_toast'
  | 'global_nav'
  | 'unknown';

interface RequestBackOptions {
  /** Fase atual (snake_case do reducer). */
  phase: string;
  /** Quem chamou (ajuda no diagnóstico). */
  source: WizardBackSource;
  /** Dados extras opcionais para telemetria. */
  meta?: Record<string, unknown>;
}

/**
 * Despacha o evento canônico de "Voltar" do wizard.
 *
 * - Sempre registra `wizard_back:click` em onboarding_events.
 * - Tenta o listener primário `wizard:request-prev-unified`. Se ninguém o
 *   processar dentro de 250ms (heurística no caller), o caller pode chamar
 *   `requestWizardBackFallback` para acionar o evento legado.
 */
export function requestWizardBack({ phase, source, meta }: RequestBackOptions): void {
  const __backEventId = makeBackEventId();
  void trackOnboardingEvent({
    phase: phase as any,
    event: 'back',
    meta: { ...meta, code: WIZARD_BACK_CODES.CLICK, source, variant: 'unified', event_id: __backEventId },
  });
  try {
    window.dispatchEvent(
      new CustomEvent(WIZARD_BACK_EVENTS.PREV_UNIFIED, {
        detail: { phase, source, ...meta, __backEventId },
      }),
    );
  } catch {
    /* fail-soft: jsdom/SSR */
  }
}

/**
 * Guard: se a navegação não progrediu após o timeout, dispara o evento
 * legado `wizard:request-back` e registra `wizard_back:guard_fallback`.
 *
 * Usado pelo WizardShell quando detecta um onBack noop (fase sem handler
 * registrado na régua atual).
 */
export function requestWizardBackFallback({ phase, source, meta }: RequestBackOptions): void {
  const __backEventId = makeBackEventId();
  void trackOnboardingEvent({
    phase: phase as any,
    event: 'back',
    meta: { ...meta, code: WIZARD_BACK_CODES.GUARD_FALLBACK, source, event_id: __backEventId },
  });
  try {
    window.dispatchEvent(
      new CustomEvent(WIZARD_BACK_EVENTS.REQUEST_BACK, {
        detail: { phase, source, fallback: true, __backEventId },
      }),
    );
  } catch {
    /* fail-soft */
  }
}

interface RequestBackForPhaseOptions extends RequestBackOptions {
  /** Em revisão, o listener legado do V2 é o dono da pilha de retorno. */
  editMode?: boolean;
}

/**
 * Escolhe automaticamente o canal correto de "Voltar" para a fase atual.
 *
 * Regra prática:
 * - `phase2_service` fora de revisão precisa falar com o WizardShell unificado
 *   (`wizard:request-prev-unified`) para voltar à triagem.
 * - Todas as demais fases do V2 continuam usando o listener legado
 *   (`wizard:request-back`), que conhece o mapa local phase→phase.
 */
export function requestWizardBackForPhase({ phase, source, meta, editMode = false }: RequestBackForPhaseOptions): void {
  const shouldUseUnified = !editMode && (phase === 'phase2_service' || phase === 'main_service');
  if (shouldUseUnified) {
    requestWizardBack({ phase, source, meta });
    return;
  }
  void trackOnboardingEvent({
    phase: phase as any,
    event: 'back',
    meta: {
      ...meta,
      code: WIZARD_BACK_CODES.CLICK,
      source,
      target_event: WIZARD_BACK_EVENTS.REQUEST_BACK,
      variant: 'unified',
    },
  });
  try {
    window.dispatchEvent(
      new CustomEvent(WIZARD_BACK_EVENTS.REQUEST_BACK, {
        detail: { phase, source, ...meta },
      }),
    );
  } catch {
    /* fail-soft */
  }
}
