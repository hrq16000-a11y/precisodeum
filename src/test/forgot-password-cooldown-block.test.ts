import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  COOLDOWN_KEY,
  startCooldown,
  readCooldownUntil,
  remainingSeconds,
  formatCooldown,
  clearCooldown,
} from '@/lib/forgotPasswordCooldown';

/**
 * Garante que o cooldown impede reenvio mesmo após:
 *  - reload da página (persistência em localStorage)
 *  - troca de rota (cooldown global, não preso a um componente)
 *  - abertura em outra aba (storage event / BroadcastChannel)
 */

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-29T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  clearCooldown();
});

describe('Cooldown — persistência cross-route', () => {
  it('grava until em localStorage para sobreviver a navegação/reload', () => {
    startCooldown(60);
    const until = readCooldownUntil();
    expect(until).toBeGreaterThan(Date.now());
    expect(localStorage.getItem(COOLDOWN_KEY)).toBe(String(until));
  });

  it('bloqueia reenvio enquanto remaining > 0 mesmo trocando de rota', () => {
    startCooldown(45);
    // Simula navegação: o componente desmonta e remonta lendo do storage
    const remountedUntil = readCooldownUntil();
    expect(remainingSeconds(remountedUntil)).toBe(45);
    // 30s depois ainda está bloqueado
    vi.advanceTimersByTime(30_000);
    expect(remainingSeconds(remountedUntil)).toBe(15);
    // Após esgotar, libera
    vi.advanceTimersByTime(20_000);
    expect(remainingSeconds(remountedUntil)).toBe(0);
  });

  it('nunca encurta um cooldown em andamento (cinto + suspensório)', () => {
    startCooldown(120);
    const longUntil = readCooldownUntil();
    startCooldown(10); // pedido menor
    expect(readCooldownUntil()).toBe(longUntil);
  });

  it('formata tempo em pt-BR amigável', () => {
    expect(formatCooldown(0)).toBe('0s');
    expect(formatCooldown(45)).toBe('45s');
    expect(formatCooldown(75)).toBe('1min 15s');
    expect(formatCooldown(120)).toBe('2min 00s');
  });
});

describe('Cooldown — sincronização entre abas', () => {
  it('storage event de outra aba propaga o until', async () => {
    const { subscribeCooldown } = await import('@/lib/forgotPasswordCooldown');
    const seen: number[] = [];
    const unsub = subscribeCooldown((rem) => seen.push(rem));

    // Simula outra aba escrevendo no localStorage
    const future = Date.now() + 90_000;
    localStorage.setItem(COOLDOWN_KEY, String(future));
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: COOLDOWN_KEY,
        newValue: String(future),
        oldValue: null,
        storageArea: localStorage,
      }),
    );

    // Avança micro-task para o handler rodar
    await vi.advanceTimersByTimeAsync(5);
    expect(seen.some((v) => v >= 89 && v <= 90)).toBe(true);

    unsub();
  });
});
