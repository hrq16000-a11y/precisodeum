/**
 * Testes do dedupe escopado por usuário em `flushDraft.ts`.
 *
 * Garantias:
 *  1. Marcar fase X para userA não bloqueia escrita da mesma fase para userB.
 *  2. Mesma fase + mesmo user dentro de 2s → bloqueado.
 *  3. Mesma fase + mesmo user após >2s → liberado novamente.
 *  4. `__resetRemoteDraftDedupe` limpa todos os marcadores.
 *  5. Callers sem userId compartilham a chave anônima sentinela.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  markRemoteDraftWritten,
  wasRemoteDraftWrittenRecently,
  __resetRemoteDraftDedupe,
} from '@/components/onboarding/wizard/phases/v2/flushDraft';

beforeEach(() => __resetRemoteDraftDedupe());
afterEach(() => __resetRemoteDraftDedupe());

describe('flushDraft dedupe — escopo por usuário', () => {
  it('isola marcadores entre usuários distintos', () => {
    markRemoteDraftWritten('phase2_service', 'user-A');
    expect(wasRemoteDraftWrittenRecently('phase2_service', 'user-A')).toBe(true);
    expect(wasRemoteDraftWrittenRecently('phase2_service', 'user-B')).toBe(false);
  });

  it('bloqueia escrita repetida da mesma fase para o mesmo usuário', () => {
    markRemoteDraftWritten('phase1_basic', 'user-A');
    expect(wasRemoteDraftWrittenRecently('phase1_basic', 'user-A')).toBe(true);
  });

  it('libera escrita após janela de 2s', () => {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      markRemoteDraftWritten('phase1_basic', 'user-A');
      expect(wasRemoteDraftWrittenRecently('phase1_basic', 'user-A')).toBe(true);
      t += 2_500; // avança 2.5s
      expect(wasRemoteDraftWrittenRecently('phase1_basic', 'user-A')).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });

  it('não bloqueia fases diferentes para o mesmo usuário', () => {
    markRemoteDraftWritten('phase1_basic', 'user-A');
    expect(wasRemoteDraftWrittenRecently('phase2_service', 'user-A')).toBe(false);
  });

  it('callers sem userId compartilham chave anônima', () => {
    markRemoteDraftWritten('phase1_basic', null);
    expect(wasRemoteDraftWrittenRecently('phase1_basic', undefined)).toBe(true);
    expect(wasRemoteDraftWrittenRecently('phase1_basic', 'user-A')).toBe(false);
  });

  it('__resetRemoteDraftDedupe limpa tudo', () => {
    markRemoteDraftWritten('phase1_basic', 'user-A');
    markRemoteDraftWritten('phase2_service', 'user-B');
    __resetRemoteDraftDedupe();
    expect(wasRemoteDraftWrittenRecently('phase1_basic', 'user-A')).toBe(false);
    expect(wasRemoteDraftWrittenRecently('phase2_service', 'user-B')).toBe(false);
  });
});
