/**
 * wizardBackOrchestrator — mutex único de "Voltar" do Wizard.
 *
 * Por que existe:
 *  - O evento global `wizard:request-back` tinha 2 listeners concorrentes
 *    (`BetModeShell` e `OnboardingV2Shell`). Em transições/handoffs ou em
 *    cliques rápidos, os dois podiam disparar e gerar:
 *      • dupla execução de flushDraft
 *      • salto de 2 fases por clique
 *      • race condition no upsert de onboarding_v2_drafts
 *
 *  - Este orquestrador centraliza:
 *      1) registro do owner ativo (apenas 1 Shell processa o evento),
 *      2) cooldown de 400ms entre cliques (anti-double-tap),
 *      3) telemetria de descarte (`wizard_back:dropped_*`).
 *
 * Como usar (nos Shells):
 *
 *   useEffect(() => {
 *     const release = registerBackOwner('v2');           // ou 'bet'
 *     const handler = (e: Event) => {
 *       if (!claimBackEvent('v2', e)) return;            // ignora se não for owner
 *       // ... lógica do back
 *     };
 *     window.addEventListener('wizard:request-back', handler);
 *     return () => {
 *       window.removeEventListener('wizard:request-back', handler);
 *       release();
 *     };
 *   }, []);
 *
 * Regra de prioridade:
 *  - V2 sempre vence quando registrado (é o orquestrador "à frente" do fluxo).
 *  - Bet só processa quando é o ÚNICO owner registrado (fase de triagem).
 *  - Se nenhum owner estiver registrado, o evento é descartado com telemetria.
 */

export type BackOwner = 'bet' | 'v2';

interface OrchestratorState {
  owners: Set<BackOwner>;
  lastClaimAt: number;
  lastEventId: string | null;
}

const COOLDOWN_MS = 400;

const state: OrchestratorState = {
  owners: new Set(),
  lastClaimAt: 0,
  lastEventId: null,
};

/**
 * Registra um Shell como owner ativo. Retorna a função de cleanup
 * (chamar no unmount).
 */
export function registerBackOwner(owner: BackOwner): () => void {
  state.owners.add(owner);
  return () => {
    state.owners.delete(owner);
  };
}

/**
 * Verifica se este `owner` deve processar o evento atual.
 * - false se cooldown não passou
 * - false se já foi consumido por outro listener (mesmo eventId)
 * - false se há owner de prioridade maior registrado (v2 > bet)
 *
 * O 1º listener que retornar true "consome" o evento; os demais retornam false.
 */
export function claimBackEvent(owner: BackOwner, ev?: Event): boolean {
  // Prioridade: se v2 está registrado e quem chama é bet, descarta.
  if (owner === 'bet' && state.owners.has('v2')) {
    logDrop('owner_priority', owner);
    return false;
  }

  // EventId: cada CustomEvent recebe um id único no detail. Se outro listener
  // já processou este evento nesta tick, ignora.
  const eventId = (ev as CustomEvent | undefined)?.detail?.__backEventId ?? null;
  if (eventId && state.lastEventId === eventId) {
    logDrop('already_consumed', owner);
    return false;
  }

  // Cooldown anti-double-tap.
  const now = Date.now();
  if (now - state.lastClaimAt < COOLDOWN_MS) {
    logDrop('cooldown', owner);
    return false;
  }

  state.lastClaimAt = now;
  state.lastEventId = eventId;
  return true;
}

/**
 * Gera um ID único para anexar ao detail do CustomEvent.
 * Usado pelo helper `requestWizardBack*` para que o orchestrator
 * possa identificar o evento.
 */
export function makeBackEventId(): string {
  // Não precisa ser cripto-seguro — só único por clique humano.
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reset interno (testes).
 */
export function __resetBackOrchestrator(): void {
  state.owners.clear();
  state.lastClaimAt = 0;
  state.lastEventId = null;
}

function logDrop(reason: 'owner_priority' | 'already_consumed' | 'cooldown', owner: BackOwner) {
  // Telemetria fail-soft via dynamic import (evita ciclo com onboarding/telemetry).
  if (typeof window === 'undefined') return;
  void import('@/components/onboarding/wizard/phases/v2/telemetry')
    .then(({ trackOnboardingEvent }) => {
      void trackOnboardingEvent({
        phase: 'unknown' as any,
        event: 'back',
        meta: {
          code: `wizard_back:dropped_${reason}`,
          owner,
        },
      });
    })
    .catch(() => { /* fail-soft */ });
}

/** Inspeção (dev/testes). */
export function __getBackOrchestratorState(): Readonly<OrchestratorState> {
  return state;
}
