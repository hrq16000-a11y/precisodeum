/**
 * crossTabSync — notifica outras abas quando o draft do onboarding muda
 * e ouve atualizações remotas via BroadcastChannel + storage event.
 *
 * Estratégia "última escrita vence" para o draft local; o Review Step
 * usa mergePreservingTouched para nunca sobrescrever edições da sessão.
 */

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
 * Detecta sessão concorrente: outra aba escreveu heartbeat há <3s.
 * Retorna `true` se houver concorrência. Não bloqueia nada.
 */
export function detectConcurrentTab(): boolean {
  const myId = getOrCreateTabId();
  const hb = readHeartbeat();
  if (!hb) return false;
  if (hb.tabId === myId) return false;
  return Date.now() - hb.updatedAt < HEARTBEAT_FRESH_MS;
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
