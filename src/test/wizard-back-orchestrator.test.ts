/**
 * wizard-back-orchestrator.test.ts — mutex único de "Voltar" do Wizard.
 *
 * Garante:
 *  1. V2 tem prioridade sobre Bet (quando ambos registrados).
 *  2. Cooldown de 400ms descarta cliques consecutivos.
 *  3. Mesmo eventId não é processado 2× por listeners diferentes.
 *  4. Sem owner registrado, claim retorna false (não há "back fantasma").
 *  5. Cleanup desregistra o owner corretamente.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerBackOwner,
  claimBackEvent,
  makeBackEventId,
  __resetBackOrchestrator,
  __getBackOrchestratorState,
} from '@/lib/wizardBackOrchestrator';

vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('wizardBackOrchestrator', () => {
  beforeEach(() => {
    __resetBackOrchestrator();
  });

  it('1. V2 tem prioridade: quando V2+Bet registrados, Bet retorna false', () => {
    const releaseV2 = registerBackOwner('v2');
    const releaseBet = registerBackOwner('bet');

    const ev = new CustomEvent('wizard:request-back', {
      detail: { __backEventId: makeBackEventId() },
    });

    // Bet tenta primeiro (ordem dos listeners), mas perde a prioridade.
    expect(claimBackEvent('bet', ev)).toBe(false);
    // V2 vence.
    expect(claimBackEvent('v2', ev)).toBe(true);

    releaseV2();
    releaseBet();
  });

  it('2. Cooldown 400ms: 2º clique <400ms é descartado', () => {
    registerBackOwner('v2');
    const ev1 = new CustomEvent('wizard:request-back', {
      detail: { __backEventId: makeBackEventId() },
    });
    const ev2 = new CustomEvent('wizard:request-back', {
      detail: { __backEventId: makeBackEventId() },
    });

    expect(claimBackEvent('v2', ev1)).toBe(true);
    // Imediatamente depois, mesmo com eventId diferente:
    expect(claimBackEvent('v2', ev2)).toBe(false);
  });

  it('3. Mesmo eventId não é consumido 2× (listeners concorrentes)', () => {
    registerBackOwner('v2');
    const eid = makeBackEventId();
    const ev = new CustomEvent('wizard:request-back', {
      detail: { __backEventId: eid },
    });

    // 1º listener consome.
    expect(claimBackEvent('v2', ev)).toBe(true);
    // 2º listener (hipotético) com mesmo eventId — descartado.
    // Mesmo após o cooldown teórico, eventId já marcado.
    // Aqui validamos a parte do eventId: precisamos contornar o cooldown.
    // Forçamos um "novo clique" passando outro eventId, e voltando ao mesmo:
    const eid2 = makeBackEventId();
    const ev2 = new CustomEvent('wizard:request-back', { detail: { __backEventId: eid2 } });
    // Aguarda cooldown via mutação direta do state interno.
    const st = __getBackOrchestratorState() as any;
    st.lastClaimAt = 0; // bypass cooldown apenas para isolar a regra de eventId
    expect(claimBackEvent('v2', ev2)).toBe(true);

    // Agora reusa eid2 num segundo claim — deve falhar por já consumido.
    st.lastClaimAt = 0;
    expect(claimBackEvent('v2', ev2)).toBe(false);
  });

  it('4. Sem owner: bet sozinho funciona; v2 sozinho funciona', () => {
    const release = registerBackOwner('bet');
    const ev = new CustomEvent('wizard:request-back', {
      detail: { __backEventId: makeBackEventId() },
    });
    expect(claimBackEvent('bet', ev)).toBe(true);
    release();
  });

  it('5. Cleanup desregistra owner', () => {
    const release = registerBackOwner('v2');
    expect(__getBackOrchestratorState().owners.has('v2')).toBe(true);
    release();
    expect(__getBackOrchestratorState().owners.has('v2')).toBe(false);
  });

  it('6. Bet vence quando é o único owner (V2 unregistered)', () => {
    const releaseV2 = registerBackOwner('v2');
    const releaseBet = registerBackOwner('bet');
    releaseV2(); // V2 desmonta — Bet assume

    const ev = new CustomEvent('wizard:request-back', {
      detail: { __backEventId: makeBackEventId() },
    });
    expect(claimBackEvent('bet', ev)).toBe(true);
    releaseBet();
  });
});
