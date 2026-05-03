import { useCallback, useEffect, useRef, useState } from "react";

interface UseActionLockOptions {
  /** Tempo mínimo em ms que o lock fica ativo após disparo (anti double-click). Default: 600ms */
  cooldownMs?: number;
}

/**
 * Hook anti double-submit.
 *
 * Garante que uma ação assíncrona (ex: submit de formulário) só seja executada
 * uma vez, mesmo com múltiplos cliques rápidos ou re-renderizações.
 *
 * Uso:
 *   const { locked, run } = useActionLock();
 *   <Button disabled={locked} onClick={() => run(async () => { await save(); })}>
 *     Salvar
 *   </Button>
 */
export function useActionLock({ cooldownMs = 600 }: UseActionLockOptions = {}) {
  const [locked, setLocked] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<T> | T): Promise<T | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      if (mountedRef.current) setLocked(true);

      const startedAt = Date.now();
      try {
        return await action();
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, cooldownMs - elapsed);
        setTimeout(() => {
          inFlightRef.current = false;
          if (mountedRef.current) setLocked(false);
        }, remaining);
      }
    },
    [cooldownMs]
  );

  return { locked, run };
}

export default useActionLock;
