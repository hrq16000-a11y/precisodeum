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
