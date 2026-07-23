/**
 * crossTabSync — notifica outras abas quando o draft do onboarding muda
 * e ouve atualizações remotas via BroadcastChannel + storage event.
 *
 * Estratégia "última escrita vence" para o draft local; o Review Step
 * usa mergePreservingTouched para nunca sobrescrever edições da sessão.
 */

import { ctDebug } from '@/lib/crossTabDebug';

const CHANNEL_NAME = 'onboarding-v2-draft';
export const DRAFT_CHANGE_EVENT = 'onboarding-v2:draft-changed';

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

export function broadcastDraftChange(reason: 'local-write' | 'remote-write' = 'local-write') {
  const ch = getChannel();
  try {
    ch?.postMessage({ type: 'draft-changed', reason, at: Date.now() });
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent(DRAFT_CHANGE_EVENT, { detail: { reason } }));
  } catch { /* ignore */ }
}

/**
 * Inscreve um listener para mudanças cross-tab.
 * Recebe eventos do BroadcastChannel + storage events do localStorage.
 */
export function subscribeDraftChange(handler: (reason: string) => void): () => void {
  const ch = getChannel();
  const onMsg = (e: MessageEvent) => {
    if (e?.data?.type === 'draft-changed') handler(e.data.reason || 'cross-tab');
  };
  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key.startsWith('onboarding-v2-draft')) handler('storage');
  };
  ch?.addEventListener('message', onMsg);
  window.addEventListener('storage', onStorage);
  return () => {
    ch?.removeEventListener('message', onMsg);
    window.removeEventListener('storage', onStorage);
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Heartbeat de aba ativa — detecta sessões concorrentes em outra aba.
 * Não bloqueia escrita; apenas permite observabilidade para evitar
 * overwrite silencioso em multi-tab.
 * ───────────────────────────────────────────────────────────────────────── */

const HEARTBEAT_KEY = 'onboarding_v2_active_tab';
const HEARTBEAT_INTERVAL_MS = 5_000;
// Ampliado de 3s → 7s: cobre janela típica entre o write da aba antiga e o
// primeiro write da nova aba após reload, evitando falso positivo de
// "concurrent_tab_detected" no boot.
const HEARTBEAT_FRESH_MS = 7_000;

function getOrCreateTabId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = sessionStorage.getItem('onboarding_v2_tab_id');
    if (!id) {
      id = (crypto as any)?.randomUUID?.() ||
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('onboarding_v2_tab_id', id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

export function getTabId(): string {
  return getOrCreateTabId();
}

interface HeartbeatRecord { tabId: string; updatedAt: number }

function readHeartbeat(): HeartbeatRecord | null {
  try {
    const raw = localStorage.getItem(HEARTBEAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HeartbeatRecord;
    if (!parsed || typeof parsed.tabId !== 'string') return null;
    return parsed;
  } catch { return null; }
}

function writeHeartbeat(tabId: string) {
  try {
    localStorage.setItem(
      HEARTBEAT_KEY,
      JSON.stringify({ tabId, updatedAt: Date.now() } satisfies HeartbeatRecord),
    );
  } catch { /* fail-soft */ }
}

/**
 * Detecta sessão concorrente: outra aba escreveu heartbeat há <FRESH_MS.
 * Retorna `true` se houver concorrência. Não bloqueia nada.
 *
 * Anti falso-positivo no boot pós-reload: se o documento veio de um reload
 * (Navigation Timing type='reload'), ignoramos heartbeat órfão — a aba
 * anterior somos nós mesmos antes do refresh.
 */
export function detectConcurrentTab(): boolean {
  const myId = getOrCreateTabId();
  const hb = readHeartbeat();
  if (!hb) return false;
  if (hb.tabId === myId) return false;
  if (Date.now() - hb.updatedAt >= HEARTBEAT_FRESH_MS) return false;
  try {
    const nav = (performance.getEntriesByType?.('navigation') || [])[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.type === 'reload') return false;
  } catch { /* fail-soft */ }
  return true;
}

/**
 * Inicia heartbeat periódico para esta aba. Retorna cleanup.
 */
export function startTabHeartbeat(): () => void {
  if (typeof window === 'undefined') return () => {};
  const myId = getOrCreateTabId();
  writeHeartbeat(myId);
  const handle = window.setInterval(() => writeHeartbeat(myId), HEARTBEAT_INTERVAL_MS);
  return () => window.clearInterval(handle);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Leader Election — garante que apenas UMA aba escreve no Supabase quando
 * o wizard está aberto em múltiplas abas. Implementado 100% via
 * localStorage (sem BroadcastChannel adicional, conforme restrição).
 *
 *  - Chave `wizard_tab_leader` guarda { tabId, ts }.
 *  - Aba candidata vira líder se não houver registro fresco (<5s).
 *  - Líder renova `ts` a cada 4s (heartbeat).
 *  - No unmount, líder apaga a chave SE ainda for dele.
 *  - Seguidora promove-se a líder se a chave ficar stale (>6s).
 *
 * `isTabLeader()` é a função utilitária única consumida por
 *  OnboardingV2Shell e flushDraft.
 * ───────────────────────────────────────────────────────────────────────── */

const LEADER_KEY = 'wizard_tab_leader';
const LEADER_HEARTBEAT_MS = 4_000;
/** Ao bootstrap: considera registro "vivo" se atualizado nos últimos 5s. */
const LEADER_FRESH_MS = 5_000;
/** Para promoção automática de seguidora: stale após 6s sem heartbeat. */
const LEADER_STALE_MS = 6_000;

interface LeaderRecord { tabId: string; ts: number }

function readLeader(): LeaderRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeaderRecord;
    if (!parsed || typeof parsed.tabId !== 'string' || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch { return null; }
}

function writeLeader(tabId: string): void {
  try {
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, ts: Date.now() } satisfies LeaderRecord));
  } catch { /* fail-soft */ }
}

/**
 * Verifica (síncronamente, sem efeito colateral) se esta aba é a líder atual.
 * Regra: existe um registro de leader cujo tabId == este e cujo ts está fresco.
 * Se a chave estiver stale (>6s) e for de OUTRA aba, esta aba ainda NÃO é
 * líder — a promoção acontece apenas dentro do heartbeat (`startTabLeaderElection`).
 *
 * Em SSR ou ambiente sem localStorage: retorna `true` (fail-open) para não
 * bloquear writes em cenários sem multi-tab.
 */
export function isTabLeader(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const myId = getOrCreateTabId();
    const rec = readLeader();
    if (!rec) return false;
    if (rec.tabId !== myId) return false;
    if (Date.now() - rec.ts > LEADER_STALE_MS) return false;
    return true;
  } catch {
    // Sem localStorage acessível → não temos como coordenar; libera o write
    // (fail-open) para preservar funcionalidade em modo privado/iframe restrito.
    return true;
  }
}

/**
 * Inicia eleição + heartbeat de liderança para esta aba. Retorna cleanup
 * que limpa o interval e remove a chave se esta aba ainda for líder.
 *
 * Chamada esperada: uma vez por montagem do shell do wizard.
 */
export function startTabLeaderElection(): () => void {
  if (typeof window === 'undefined') return () => {};
  const myId = getOrCreateTabId();

  const debugLog = (event: string, data?: Record<string, unknown>) => {
    try {
      // Lazy require para não quebrar em SSR/testes unitários sem alias '@'.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ctDebug } = require('@/lib/crossTabDebug');
      ctDebug('leader', event, data);
    } catch { /* noop */ }
  };

  const tryClaimLeadership = (source: 'boot' | 'heartbeat') => {
    const rec = readLeader();
    const now = Date.now();
    const noLeader = !rec;
    const ownLeader = rec?.tabId === myId;
    const staleLeader = rec && now - rec.ts > LEADER_FRESH_MS;
    if (noLeader || ownLeader || staleLeader) {
      writeLeader(myId);
      debugLog('claim', {
        tabId: myId,
        source,
        reason: noLeader ? 'no_leader' : ownLeader ? 'renew' : 'stale_takeover',
      });
    }
  };

  tryClaimLeadership('boot');

  const handle = window.setInterval(() => {
    const rec = readLeader();
    const now = Date.now();
    if (!rec || rec.tabId === myId) {
      writeLeader(myId);
    } else if (now - rec.ts > LEADER_STALE_MS) {
      writeLeader(myId);
      debugLog('promote', { tabId: myId, previous: rec.tabId, staleMs: now - rec.ts });
    }
  }, LEADER_HEARTBEAT_MS);

  return () => {
    try { window.clearInterval(handle); } catch { /* noop */ }
    try {
      const rec = readLeader();
      if (rec?.tabId === myId) {
        localStorage.removeItem(LEADER_KEY);
        debugLog('release', { tabId: myId });
      }
    } catch { /* noop */ }
  };
}

/** Test-only: limpa registro de líder entre testes. */
export function __resetTabLeader(): void {
  try { localStorage.removeItem(LEADER_KEY); } catch { /* noop */ }
}
