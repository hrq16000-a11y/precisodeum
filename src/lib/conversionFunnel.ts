/**
 * conversionFunnel — telemetria de conversão do wizard com origem rastreada.
 *
 * Permite medir taxa de conversão por etapa (`phase`) e por origem do contato
 * de suporte (`source`):
 *  - 'exit_intent' (pop-up de saída)
 *  - 'help_page'   (botão WhatsApp da página /ajuda/cadastro)
 *
 * Também marca em sessionStorage que o usuário JÁ contatou o suporte ou JÁ
 * visitou a página de ajuda — usado pelo ExitIntentDialog para se suprimir
 * (sem pop-up redundante na mesma sessão).
 *
 * Eventos gravados via trackOnboardingEvent (onboarding_events):
 *  - support_whatsapp_clicked  { source, intent, phase, variant? }
 *  - help_page_visited         { intent?, phase? }
 *
 * Sem PII. Fail-soft.
 */

import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import type { ExitIntentIntent, ExitIntentVariant } from './exitIntentVariants';

export type SupportSource =
  | 'exit_intent'        // pop-up de saída do wizard
  | 'help_page'          // /ajuda/cadastro
  | 'recovery_page'      // /cadastro/retomar (oferece WhatsApp pra desbloquear)
  | 'save_later_modal'   // modal de "Salvar e continuar mais tarde"
  | 'help_card'
  | 'footer'
  | 'other';

/** Destino do "Salvar e continuar mais tarde" — usado em métricas A/B. */
export type SaveLaterDestination = 'dashboard' | 'recovery_page';

const SUPPORT_KEY = 'wizard:support-contacted';
const HELP_VISIT_KEY = 'wizard:help-page-visited';

export interface SupportContactMeta {
  source: SupportSource;
  intent?: ExitIntentIntent;
  phase?: string;
  variant?: ExitIntentVariant;
}

/** Registra clique em WhatsApp do suporte e marca sessão. */
export function markSupportContacted(meta: SupportContactMeta): void {
  try {
    sessionStorage.setItem(SUPPORT_KEY, '1');
  } catch {
    /* noop */
  }
  // Não passamos `intent: 'unknown'` em meta para permitir que a telemetria
  // auto-injete o intent REAL persistido em sessionStorage (PhaseWho/triage).
  const intentMeta = meta.intent && meta.intent !== 'unknown' ? { intent: meta.intent } : {};
  void trackOnboardingEvent({
    phase: (meta.phase || 'unknown') as any,
    event: 'support_whatsapp_clicked' as any,
    meta: {
      source: meta.source,
      variant: meta.variant ?? null,
      ...intentMeta,
    },
  });
}

/** Registra visita à página /ajuda/cadastro e marca sessão. */
export function markHelpPageVisited(meta: { intent?: ExitIntentIntent; phase?: string } = {}): void {
  try {
    sessionStorage.setItem(HELP_VISIT_KEY, '1');
  } catch {
    /* noop */
  }
  const intentMeta = meta.intent && meta.intent !== 'unknown' ? { intent: meta.intent } : {};
  void trackOnboardingEvent({
    phase: (meta.phase || 'help_page') as any,
    event: 'help_page_visited' as any,
    meta: { ...intentMeta },
  });
}

/** True se o exit-intent deve ser suprimido (suporte já contatado / ajuda já vista). */
export function shouldSuppressExitIntent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      sessionStorage.getItem(SUPPORT_KEY) === '1' ||
      sessionStorage.getItem(HELP_VISIT_KEY) === '1'
    );
  } catch {
    return false;
  }
}

/** Helpers de teste. */
export function resetConversionFunnelForTest(): void {
  try {
    sessionStorage.removeItem(SUPPORT_KEY);
    sessionStorage.removeItem(HELP_VISIT_KEY);
  } catch {
    /* noop */
  }
}
