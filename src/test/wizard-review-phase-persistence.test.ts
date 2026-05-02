/**
 * useReviewPhasePersistence — testes da persistência da última fase
 * renderizável da régua de revisão em sessionStorage.
 *
 * Cobre:
 *  - Persistência somente em modo revisão.
 *  - Rejeição de fases-fantasma (não-renderáveis) e fora da régua.
 *  - Restauração via `readPersistedReviewPhase`.
 *  - Limpeza em `done` e via `clearPersistedReviewPhase`.
 *  - Fail-soft contra storage indisponível.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  readPersistedReviewPhase,
  useReviewPhasePersistence,
  clearPersistedReviewPhase,
  __TEST__,
} from '@/components/onboarding/wizard/useReviewPhasePersistence';

const KEY = __TEST__.STORAGE_KEY;

describe('useReviewPhasePersistence', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('persiste fase renderizável quando isReview=true', () => {
    const { rerender } = renderHook(
      ({ phase, isReview }) => useReviewPhasePersistence(phase as any, isReview),
      { initialProps: { phase: 'main_service', isReview: true } },
    );
    expect(window.sessionStorage.getItem(KEY)).toBe('main_service');
    rerender({ phase: 'main_document', isReview: true });
    expect(window.sessionStorage.getItem(KEY)).toBe('main_document');
  });

  it('NÃO persiste quando isReview=false', () => {
    renderHook(() => useReviewPhasePersistence('main_service' as any, false));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('NÃO persiste fases fantasmas (não-renderáveis)', () => {
    renderHook(() => useReviewPhasePersistence('main_action' as any, true));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('NÃO persiste fase fora da régua', () => {
    renderHook(() => useReviewPhasePersistence('totally_unknown_phase' as any, true));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('limpa storage ao chegar em done', () => {
    window.sessionStorage.setItem(KEY, 'main_service');
    renderHook(() => useReviewPhasePersistence('done' as any, true));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('readPersistedReviewPhase retorna fase válida', () => {
    window.sessionStorage.setItem(KEY, 'main_document');
    expect(readPersistedReviewPhase(true)).toBe('main_document');
  });

  it('readPersistedReviewPhase ignora valores inválidos', () => {
    window.sessionStorage.setItem(KEY, 'main_action'); // fantasma
    expect(readPersistedReviewPhase(true)).toBeNull();
    window.sessionStorage.setItem(KEY, 'lixo_qualquer');
    expect(readPersistedReviewPhase(true)).toBeNull();
  });

  it('readPersistedReviewPhase retorna null quando isReview=false', () => {
    window.sessionStorage.setItem(KEY, 'main_service');
    expect(readPersistedReviewPhase(false)).toBeNull();
  });

  it('clearPersistedReviewPhase apaga o storage', () => {
    window.sessionStorage.setItem(KEY, 'main_service');
    clearPersistedReviewPhase();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('é fail-soft quando sessionStorage lança (modo privado/quota)', () => {
    const original = window.sessionStorage.setItem;
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });
    expect(() => {
      renderHook(() => useReviewPhasePersistence('main_service' as any, true));
    }).not.toThrow();
    spy.mockRestore();
    window.sessionStorage.setItem = original;
  });
});
