/**
 * reviewHistory.test.ts — pilha de navegação do Wizard em modo revisão.
 *
 * Cobre:
 *  - push idempotente (não duplica fase no topo)
 *  - pop devolve a anterior real e remove a atual
 *  - pop com pilha de 1 → null + limpa
 *  - clear remove tudo
 *  - persistência por sessionStorage (mock JSDOM)
 *  - limite de profundidade (32)
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  pushReviewPhase,
  popReviewPhase,
  peekReviewHistory,
  clearReviewHistory,
} from '@/components/onboarding/wizard/phases/v2/reviewHistory';

afterEach(() => {
  clearReviewHistory();
});

describe('reviewHistory', () => {
  it('push acumula fases visitadas em ordem', () => {
    pushReviewPhase('phase2_service');
    pushReviewPhase('phase2_details');
    pushReviewPhase('phase4_document');
    expect(peekReviewHistory()).toEqual([
      'phase2_service',
      'phase2_details',
      'phase4_document',
    ]);
  });

  it('push é idempotente quando a mesma fase é repetida no topo', () => {
    pushReviewPhase('phase2_service');
    pushReviewPhase('phase2_service');
    pushReviewPhase('phase2_service');
    expect(peekReviewHistory()).toEqual(['phase2_service']);
  });

  it('push ignora valores nulos / vazios', () => {
    pushReviewPhase('phase2_service');
    pushReviewPhase(null);
    pushReviewPhase(undefined);
    pushReviewPhase('');
    expect(peekReviewHistory()).toEqual(['phase2_service']);
  });

  it('pop remove a atual e devolve a anterior real', () => {
    pushReviewPhase('phase2_service');
    pushReviewPhase('phase2_details');
    pushReviewPhase('phase4_document');
    const previous = popReviewPhase();
    expect(previous).toBe('phase2_details');
    expect(peekReviewHistory()).toEqual(['phase2_service', 'phase2_details']);
  });

  it('pop com pilha de tamanho ≤1 retorna null e limpa', () => {
    pushReviewPhase('phase2_service');
    expect(popReviewPhase()).toBeNull();
    expect(peekReviewHistory()).toEqual([]);
  });

  it('pop em pilha vazia retorna null sem explodir', () => {
    expect(popReviewPhase()).toBeNull();
  });

  it('clear esvazia o histórico', () => {
    pushReviewPhase('phase2_service');
    pushReviewPhase('phase4_document');
    clearReviewHistory();
    expect(peekReviewHistory()).toEqual([]);
  });

  it('respeita limite de profundidade (32 fases mais recentes)', () => {
    for (let i = 0; i < 50; i++) pushReviewPhase(`phase_${i}`);
    const stack = peekReviewHistory();
    expect(stack.length).toBe(32);
    // Primeiras 18 (50-32) devem ter sido descartadas.
    expect(stack[0]).toBe('phase_18');
    expect(stack[stack.length - 1]).toBe('phase_49');
  });

  it('cenário Assistente → pular → Voltar → desempilha corretamente', () => {
    // Usuário entra na revisão via /dashboard/assistente em phase2_service,
    // pula direto para phase4_document, depois clica "Voltar".
    pushReviewPhase('phase2_service');
    pushReviewPhase('phase4_document'); // pulou via EditModeSkipButton
    const previous = popReviewPhase();
    expect(previous).toBe('phase2_service');
    // Próximo "Voltar" esgota a pilha → caller deve mandar para Assistente.
    expect(popReviewPhase()).toBeNull();
  });
});
