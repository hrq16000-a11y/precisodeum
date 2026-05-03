import { useCallback, useEffect, useRef, useState } from "react";

export interface UseActionLockOptions {
  /** Tempo máximo (ms) antes de abortar a Promise e liberar o lock. Default: 15000. */
  timeoutMs?: number;
}

/**
 * useActionLock — anti double-submit com timeout forçado.
 *
 * Recebe uma função assíncrona e devolve `[wrapped, isLocked]`:
 *   - `wrapped`: versão envelopada. Enquanto a Promise anterior estiver
 *     pendente, novas chamadas são ignoradas (retornam `undefined`).
 *   - `isLocked`: boolean reativo para desabilitar botões durante o submit.
 *
 * Para evitar "Botão da Morte" quando a requisição trava sem resposta
 * (queda de rede sem timeout do fetch), aplicamos `Promise.race` contra
 * um timer. Se o timeout dispara antes, a action rejeita com Error('TIMEOUT'),
 * o `finally` libera o lock e o erro propaga para o chamador tratar.
 */
export function useActionLock<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult> | TResult,
  options: UseActionLockOptions = {}
): [(...args: TArgs) => Promise<TResult | undefined>, boolean] {
  const { timeoutMs = 15000 } = options;
  const [isLocked, setIsLocked] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const wrapped = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      if (mountedRef.current) setIsLocked(true);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const actionPromise = Promise.resolve().then(() => actionRef.current(...args));
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
        });
        return (await Promise.race([actionPromise, timeoutPromise])) as TResult;
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        inFlightRef.current = false;
        if (mountedRef.current) setIsLocked(false);
      }
    },
    [timeoutMs]
  );

  return [wrapped, isLocked];
}

export default useActionLock;
