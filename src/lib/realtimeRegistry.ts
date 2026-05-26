/**
 * realtimeRegistry — governança mínima de canais Supabase Realtime.
 *
 * Objetivo (PR 6 · governança mínima, NÃO framework):
 *  - Garante UM canal por nome (refcount), evitando subscribe duplicado
 *    quando o mesmo componente é montado em paralelo (StrictMode/duplo
 *    mount, navegação rápida, suspense retries).
 *  - Cleanup com pequeno atraso (DISPOSE_DELAY_MS) para tolerar o ciclo
 *    unmount→remount imediato do React StrictMode sem derrubar o canal.
 *  - Cleanup race-safe: se um novo acquire chegar dentro da janela, o
 *    dispose pendente é cancelado e o canal é reaproveitado.
 *
 * Premissa: cada `name` é dono de uma configuração estável de handlers.
 * Se dois consumidores precisam de filtros diferentes, devem usar nomes
 * distintos — esta camada não funde handlers.
 *
 * NÃO é um event bus. NÃO substitui `supabase.channel(...)`. É opt-in:
 * hooks/componentes que ainda chamam `supabase.channel` direto continuam
 * funcionando.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Entry {
  channel: RealtimeChannel;
  refCount: number;
  disposeTimer: ReturnType<typeof setTimeout> | null;
}

const registry = new Map<string, Entry>();

/** Janela curta para absorver unmount→remount do StrictMode/navegação. */
const DISPOSE_DELAY_MS = 50;

export interface AcquireOptions {
  /**
   * Configura handlers `.on(...)` no canal recém-criado. Chamado APENAS
   * na primeira aquisição do nome. Deve retornar o próprio canal.
   */
  setup: (channel: RealtimeChannel) => RealtimeChannel;
}

export function acquireChannel(name: string, opts: AcquireOptions): RealtimeChannel {
  const existing = registry.get(name);
  if (existing) {
    if (existing.disposeTimer != null) {
      clearTimeout(existing.disposeTimer);
      existing.disposeTimer = null;
    }
    existing.refCount += 1;
    return existing.channel;
  }
  const channel = opts.setup(supabase.channel(name)).subscribe();
  registry.set(name, { channel, refCount: 1, disposeTimer: null });
  return channel;
}

export function releaseChannel(name: string): void {
  const entry = registry.get(name);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;
  if (entry.disposeTimer != null) return;
  entry.disposeTimer = setTimeout(() => {
    const current = registry.get(name);
    if (!current || current.refCount > 0) return;
    try { supabase.removeChannel(current.channel); } catch { /* noop */ }
    registry.delete(name);
  }, DISPOSE_DELAY_MS);
}

/** Diagnóstico opcional (dev/admin). Não usar em hot path. */
export function __realtimeRegistrySnapshot() {
  return Array.from(registry.entries()).map(([name, e]) => ({
    name,
    refCount: e.refCount,
    pendingDispose: e.disposeTimer != null,
  }));
}
