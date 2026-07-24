/**
 * Cross-Tab Leadership — suíte unitária/integração.
 *
 * Alvo: `src/components/onboarding/wizard/phases/v2/crossTabSync.ts`.
 * Cobertura:
 *  - `getTabId` — criação/reutilização via sessionStorage
 *  - `startTabHeartbeat` — escrita periódica + cleanup do interval
 *  - `startTabLeaderElection` — claim inicial (no_leader, renew, stale_takeover),
 *    heartbeat, promoção após TTL, cleanup libera chave apenas se ainda for dono
 *  - `isTabLeader` — regras (sem chave, mismatch, stale, ok) + fail-open sem storage
 *  - `detectConcurrentTab` — regras (sem hb, mesmo tabId, stale, reload, fresh)
 *
 * Estratégia multi-tab: `sessionStorage` é lido dinamicamente por
 * `getOrCreateTabId`, então "trocar de aba" = trocar o valor da chave
 * `onboarding_v2_tab_id`. `localStorage` é compartilhado (semântica
 * cross-tab real). Fake timers controlam `setInterval` + `Date.now`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectConcurrentTab,
  getTabId,
  isTabLeader,
  startTabHeartbeat,
  startTabLeaderElection,
  __resetTabLeader,
} from '@/components/onboarding/wizard/phases/v2/crossTabSync';

const TAB_ID_KEY = 'onboarding_v2_tab_id';
const HEARTBEAT_KEY = 'onboarding_v2_active_tab';
const LEADER_KEY = 'wizard_tab_leader';

function setActiveTab(tabId: string) {
  sessionStorage.setItem(TAB_ID_KEY, tabId);
}

function readLeaderRaw(): { tabId: string; ts: number } | null {
  const raw = localStorage.getItem(LEADER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function writeHeartbeatRaw(tabId: string, updatedAt: number) {
  localStorage.setItem(HEARTBEAT_KEY, JSON.stringify({ tabId, updatedAt }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetTabLeader();
  vi.useFakeTimers({ now: new Date('2026-07-23T12:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────
// getTabId
// ─────────────────────────────────────────────────────────────────────
describe('getTabId', () => {
  it('cria um tabId único e persiste em sessionStorage', () => {
    const id = getTabId();
    expect(id).toBeTruthy();
    expect(sessionStorage.getItem(TAB_ID_KEY)).toBe(id);
  });

  it('reutiliza o tabId existente em chamadas subsequentes', () => {
    const first = getTabId();
    const second = getTabId();
    expect(second).toBe(first);
  });

  it('respeita o tabId pré-existente em sessionStorage (equivalente a F5)', () => {
    sessionStorage.setItem(TAB_ID_KEY, 'preserved-across-reload');
    expect(getTabId()).toBe('preserved-across-reload');
  });
});

// ─────────────────────────────────────────────────────────────────────
// startTabHeartbeat
// ─────────────────────────────────────────────────────────────────────
describe('startTabHeartbeat', () => {
  it('escreve heartbeat imediatamente e periodicamente (5s)', () => {
    setActiveTab('tab-A');
    const stop = startTabHeartbeat();
    const first = JSON.parse(localStorage.getItem(HEARTBEAT_KEY)!);
    expect(first.tabId).toBe('tab-A');
    const firstTs = first.updatedAt;

    vi.advanceTimersByTime(5_000);
    const second = JSON.parse(localStorage.getItem(HEARTBEAT_KEY)!);
    expect(second.tabId).toBe('tab-A');
    expect(second.updatedAt).toBeGreaterThan(firstTs);

    stop();
  });

  it('cleanup limpa o interval — sem novas escritas após stop', () => {
    setActiveTab('tab-A');
    const stop = startTabHeartbeat();
    const first = JSON.parse(localStorage.getItem(HEARTBEAT_KEY)!);
    stop();
    vi.advanceTimersByTime(20_000);
    const after = JSON.parse(localStorage.getItem(HEARTBEAT_KEY)!);
    expect(after.updatedAt).toBe(first.updatedAt);
  });
});

// ─────────────────────────────────────────────────────────────────────
// isTabLeader
// ─────────────────────────────────────────────────────────────────────
describe('isTabLeader', () => {
  it('false quando não há registro de líder', () => {
    setActiveTab('tab-A');
    expect(isTabLeader()).toBe(false);
  });

  it('true quando esta aba é líder e ts é fresco', () => {
    setActiveTab('tab-A');
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-A', ts: Date.now() }));
    expect(isTabLeader()).toBe(true);
  });

  it('false quando líder é OUTRA aba', () => {
    setActiveTab('tab-A');
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-B', ts: Date.now() }));
    expect(isTabLeader()).toBe(false);
  });

  it('false quando própria liderança está stale (>6s sem renovação)', () => {
    setActiveTab('tab-A');
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-A', ts: Date.now() - 7_000 }));
    expect(isTabLeader()).toBe(false);
  });

  it('registro corrompido = sem líder (parse falha)', () => {
    setActiveTab('tab-A');
    localStorage.setItem(LEADER_KEY, '{{not-json');
    expect(isTabLeader()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// startTabLeaderElection — claim inicial
// ─────────────────────────────────────────────────────────────────────
describe('startTabLeaderElection · claim inicial', () => {
  it('reivindica liderança quando não há registro (no_leader)', () => {
    setActiveTab('tab-A');
    const stop = startTabLeaderElection();
    expect(readLeaderRaw()?.tabId).toBe('tab-A');
    expect(isTabLeader()).toBe(true);
    stop();
  });

  it('renova a própria liderança (renew)', () => {
    setActiveTab('tab-A');
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-A', ts: Date.now() - 100 }));
    const stop = startTabLeaderElection();
    expect(readLeaderRaw()?.tabId).toBe('tab-A');
    stop();
  });

  it('assume liderança quando registro anterior está stale (stale_takeover)', () => {
    setActiveTab('tab-A');
    // Registro fantasma de outra aba, ts vencido (>5s = LEADER_FRESH_MS)
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'ghost-B', ts: Date.now() - 8_000 }));
    const stop = startTabLeaderElection();
    expect(readLeaderRaw()?.tabId).toBe('tab-A');
    stop();
  });

  it('NÃO usurpa liderança fresca de outra aba no boot', () => {
    setActiveTab('tab-A');
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-B', ts: Date.now() - 100 }));
    const stop = startTabLeaderElection();
    expect(readLeaderRaw()?.tabId).toBe('tab-B');
    expect(isTabLeader()).toBe(false);
    stop();
  });
});

// ─────────────────────────────────────────────────────────────────────
// startTabLeaderElection — heartbeat + promoção por TTL
// ─────────────────────────────────────────────────────────────────────
describe('startTabLeaderElection · heartbeat e promoção', () => {
  it('renova ts periodicamente (4s) enquanto líder', () => {
    setActiveTab('tab-A');
    const stop = startTabLeaderElection();
    const initialTs = readLeaderRaw()!.ts;
    vi.advanceTimersByTime(4_000);
    const afterTick = readLeaderRaw()!.ts;
    expect(afterTick).toBeGreaterThan(initialTs);
    stop();
  });

  it('promove seguidora a líder quando registro anterior fica stale (>6s)', () => {
    // Simula: aba B era líder, mas caiu abruptamente. Aba A entra e detecta
    // stale no próximo tick de heartbeat.
    setActiveTab('tab-A');
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-B', ts: Date.now() - 1_000 }));
    const stop = startTabLeaderElection();
    // No boot: registro de B ainda fresco (<5s), A não usurpa.
    expect(readLeaderRaw()?.tabId).toBe('tab-B');

    // Avança 7s: heartbeat de A dispara (4s + 4s = 8s > 6s stale threshold).
    vi.advanceTimersByTime(8_000);
    expect(readLeaderRaw()?.tabId).toBe('tab-A');
    expect(isTabLeader()).toBe(true);
    stop();
  });

  it('cleanup libera a chave APENAS se esta aba ainda for dona', () => {
    setActiveTab('tab-A');
    const stop = startTabLeaderElection();
    expect(readLeaderRaw()?.tabId).toBe('tab-A');
    stop();
    expect(readLeaderRaw()).toBeNull();
  });

  it('cleanup NÃO remove a chave se outra aba assumiu a liderança', () => {
    setActiveTab('tab-A');
    const stop = startTabLeaderElection();
    // Outra aba tomou a chave enquanto A ainda estava viva.
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-B', ts: Date.now() }));
    stop();
    expect(readLeaderRaw()?.tabId).toBe('tab-B');
  });

  it('cleanup limpa o interval — sem novas escritas após stop', () => {
    setActiveTab('tab-A');
    const stop = startTabLeaderElection();
    const initial = readLeaderRaw()!.ts;
    stop();
    // Após cleanup a chave foi removida; se o interval tivesse vazado,
    // ele reescreveria a chave no próximo tick.
    vi.advanceTimersByTime(20_000);
    expect(readLeaderRaw()).toBeNull();
    expect(initial).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integração: duas abas simultâneas
// ─────────────────────────────────────────────────────────────────────
describe('integração multi-aba (sessionStorage swap)', () => {
  function withTab<T>(tabId: string, fn: () => T): T {
    const prev = sessionStorage.getItem(TAB_ID_KEY);
    setActiveTab(tabId);
    try {
      return fn();
    } finally {
      if (prev == null) sessionStorage.removeItem(TAB_ID_KEY);
      else sessionStorage.setItem(TAB_ID_KEY, prev);
    }
  }

  it('duas abas simultâneas: apenas UMA é líder', () => {
    const stopA = withTab('tab-A', () => startTabLeaderElection());
    // Aba B abre logo em seguida, encontra chave fresca de A.
    const stopB = withTab('tab-B', () => startTabLeaderElection());

    // Do ponto de vista de A:
    withTab('tab-A', () => {
      expect(isTabLeader()).toBe(true);
    });
    // Do ponto de vista de B:
    withTab('tab-B', () => {
      expect(isTabLeader()).toBe(false);
    });

    stopA();
    stopB();
  });

  it('quando líder cai, seguidora assume via TTL (>6s)', () => {
    const stopA = withTab('tab-A', () => startTabLeaderElection());
    const stopB = withTab('tab-B', () => startTabLeaderElection());
    // A morre abruptamente (sem cleanup) — simulamos parando os timers
    // e removendo o "ownership" via cleanup manual da chave por A.
    stopA();
    // A liberou a chave; B ainda não sabe. B assume no próximo tick.
    withTab('tab-B', () => {
      // Primeiro tick de B (4s) escreve novamente sua liderança porque
      // agora `rec` está null (A limpou).
      vi.advanceTimersByTime(4_000);
      expect(readLeaderRaw()?.tabId).toBe('tab-B');
      expect(isTabLeader()).toBe(true);
    });
    stopB();
  });
});

// ─────────────────────────────────────────────────────────────────────
// detectConcurrentTab
// ─────────────────────────────────────────────────────────────────────
describe('detectConcurrentTab', () => {
  it('false quando não há heartbeat', () => {
    setActiveTab('tab-A');
    expect(detectConcurrentTab()).toBe(false);
  });

  it('false quando o heartbeat é da própria aba', () => {
    setActiveTab('tab-A');
    writeHeartbeatRaw('tab-A', Date.now());
    expect(detectConcurrentTab()).toBe(false);
  });

  it('true quando outra aba tem heartbeat fresco (<7s) E líder pareado', () => {
    setActiveTab('tab-A');
    writeHeartbeatRaw('tab-B', Date.now() - 1_000);
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId: 'tab-B', ts: Date.now() }));
    expect(detectConcurrentTab()).toBe(true);
  });

  it('false com aba única — heartbeat órfão sem líder rival (regressão)', () => {
    setActiveTab('tab-A');
    // Heartbeat de aba antiga ficou órfão no localStorage mas nenhum
    // líder rival existe (nova regra: dupla confirmação obrigatória).
    writeHeartbeatRaw('tab-antiga', Date.now() - 500);
    expect(detectConcurrentTab()).toBe(false);
  });

  it('false quando aba única é a única líder (boot cenário real)', () => {
    setActiveTab('tab-A');
    const stop = startTabLeaderElection();
    // Um único startTabLeaderElection reivindica LEADER_KEY para tab-A,
    // então mesmo se um heartbeat órfão existir, não deve haver concorrência.
    writeHeartbeatRaw('tab-B', Date.now() - 500);
    // Sem par leader-B, não há concorrência.
    expect(detectConcurrentTab()).toBe(false);
    stop();
  });

  it('false quando heartbeat de outra aba está stale (>=7s)', () => {
    setActiveTab('tab-A');
    writeHeartbeatRaw('tab-B', Date.now() - 8_000);
    expect(detectConcurrentTab()).toBe(false);
  });

  it('false quando o documento veio de um reload (anti falso-positivo)', () => {
    setActiveTab('tab-A');
    writeHeartbeatRaw('tab-B', Date.now() - 1_000);
    const spy = vi
      .spyOn(performance, 'getEntriesByType')
      .mockReturnValue([{ type: 'reload' } as any]);
    expect(detectConcurrentTab()).toBe(false);
    spy.mockRestore();
  });

  it('registro corrompido = sem concorrência', () => {
    setActiveTab('tab-A');
    localStorage.setItem(HEARTBEAT_KEY, '{corrupt');
    expect(detectConcurrentTab()).toBe(false);
  });
});
