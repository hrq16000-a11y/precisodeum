/**
 * Sincronização do cooldown do "Esqueci minha senha" entre abas/janelas.
 *
 * Estratégia (cinto + suspensório):
 *  1. Persistência em localStorage (sobrevive a reload e troca de aba).
 *  2. BroadcastChannel quando disponível (notificação instantânea entre abas).
 *  3. Fallback automático para `storage` events (Safari antigo, iframes).
 *
 * O contrato é simples: o "tempo restante" é sempre derivado de `until` (epoch ms).
 * Cada aba calcula `Math.ceil((until - Date.now())/1000)` localmente, então
 * mesmo se um evento for perdido a aba se auto-corrige no próximo tick.
 */

export const COOLDOWN_KEY = 'forgot-password:cooldown-until';
const CHANNEL_NAME = 'forgot-password-cooldown';

export type CooldownPayload = { until: number };

const safeNow = () => Date.now();

export const readCooldownUntil = (): number => {
  try {
    return Number(localStorage.getItem(COOLDOWN_KEY) || '0') || 0;
  } catch {
    return 0;
  }
};

export const remainingSeconds = (until: number, now: number = safeNow()): number => {
  if (!until || until <= now) return 0;
  return Math.ceil((until - now) / 1000);
};

export const writeCooldownUntil = (until: number): void => {
  try {
    if (until <= safeNow()) {
      localStorage.removeItem(COOLDOWN_KEY);
    } else {
      localStorage.setItem(COOLDOWN_KEY, String(until));
    }
  } catch {
    /* noop */
  }
};

type Listener = (remaining: number, until: number) => void;

interface BroadcastLike {
  postMessage: (msg: CooldownPayload) => void;
  close: () => void;
  onmessage: ((ev: MessageEvent<CooldownPayload>) => void) | null;
}

const createBroadcast = (): BroadcastLike | null => {
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    return new BroadcastChannel(CHANNEL_NAME) as unknown as BroadcastLike;
  } catch {
    return null;
  }
};

/**
 * Inicia/atualiza o cooldown. Persiste em localStorage e notifica outras abas.
 * Retorna o `until` efetivo (caso outra aba já tenha um cooldown maior, mantém o maior).
 */
export const startCooldown = (seconds: number): number => {
  const proposed = safeNow() + Math.max(0, seconds) * 1000;
  const current = readCooldownUntil();
  const until = Math.max(proposed, current); // nunca encurta um cooldown em andamento
  writeCooldownUntil(until);
  try {
    const ch = createBroadcast();
    if (ch) {
      ch.postMessage({ until });
      ch.close();
    }
  } catch {
    /* noop */
  }
  return until;
};

/**
 * Inscreve um listener que recebe o tempo restante (em segundos) sempre que:
 *  - outra aba alterar o cooldown (BroadcastChannel ou storage event);
 *  - o tick de 1s decrementar o contador.
 *
 * Retorna função de unsubscribe.
 */
export const subscribeCooldown = (listener: Listener): (() => void) => {
  let until = readCooldownUntil();
  let alive = true;

  const emit = () => {
    if (!alive) return;
    listener(remainingSeconds(until), until);
  };

  // Tick local: 1s
  const tick = () => {
    if (!alive) return;
    const rem = remainingSeconds(until);
    listener(rem, until);
    if (rem > 0) {
      timer = window.setTimeout(tick, 1000);
    }
  };
  let timer = window.setTimeout(tick, 1000);

  // BroadcastChannel
  const ch = createBroadcast();
  if (ch) {
    ch.onmessage = (ev) => {
      const next = Number(ev.data?.until || 0);
      if (next > until) {
        until = next;
        window.clearTimeout(timer);
        timer = window.setTimeout(tick, 0);
      } else if (next === 0) {
        until = 0;
        emit();
      }
    };
  }

  // storage event (fallback + cross-context)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== COOLDOWN_KEY) return;
    const next = Number(e.newValue || '0') || 0;
    until = next;
    window.clearTimeout(timer);
    timer = window.setTimeout(tick, 0);
  };
  window.addEventListener('storage', onStorage);

  // Emissão inicial síncrona
  emit();

  return () => {
    alive = false;
    window.clearTimeout(timer);
    window.removeEventListener('storage', onStorage);
    try { ch?.close(); } catch { /* noop */ }
  };
};

/**
 * Limpa o cooldown (uso administrativo / testes).
 */
export const clearCooldown = (): void => {
  try { localStorage.removeItem(COOLDOWN_KEY); } catch { /* noop */ }
  try {
    const ch = createBroadcast();
    if (ch) {
      ch.postMessage({ until: 0 });
      ch.close();
    }
  } catch { /* noop */ }
};

export const formatCooldown = (s: number): string => {
  if (s <= 0) return '0s';
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}min ${r.toString().padStart(2, '0')}s`;
};
