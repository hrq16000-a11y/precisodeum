/**
 * useRealtimeChannel — wrapper mínimo sobre `realtimeRegistry`.
 *
 * Garante:
 *  - subscribe único por `name` (mesmo sob StrictMode/duplo mount);
 *  - cleanup no unmount (release no registry);
 *  - sem race entre subscribe e unmount imediato.
 *
 * Uso:
 *   useRealtimeChannel(
 *     userId ? `profile-preferences:${userId}` : null,
 *     (ch) => ch.on('postgres_changes', { ... }, handler),
 *     [userId],
 *   );
 *
 * Se `name` for null/undefined, nada é feito.
 *
 * IMPORTANTE: a função `setup` é executada apenas na PRIMEIRA aquisição
 * do nome. Não use `setup` para capturar estado que muda — prefira refs.
 */
import { useEffect } from 'react';
import { acquireChannel, releaseChannel, type AcquireOptions } from '@/lib/realtimeRegistry';

export function useRealtimeChannel(
  name: string | null | undefined,
  setup: AcquireOptions['setup'],
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    if (!name) return;
    acquireChannel(name, { setup });
    return () => releaseChannel(name);
    // setup é intencionalmente ignorado nas deps — handlers devem ser estáveis
    // ou ler de refs. `deps` permite ao consumidor recriar quando necessário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ...deps]);
}
