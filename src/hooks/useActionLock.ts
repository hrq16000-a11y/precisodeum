import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useActionLock — anti double-submit.
 *
 * Recebe uma função assíncrona e devolve uma tupla [wrapped, isLocked]:
 *   - `wrapped`: versão envelopada da função. Enquanto a Promise anterior
 *     estiver pendente, novas chamadas são ignoradas imediatamente
 *     (retornam `undefined`, sem efeito colateral).
 *   - `isLocked`: boolean reativo para desabilitar o botão durante o submit.
 *
 * O lock é liberado em `finally`, garantindo destravamento mesmo em erro.
 */
export function useActionLock<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult> | TResult
): [(...args: TArgs) => Promise<TResult | undefined>, boolean] {
  const [isLocked, setIsLocked] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  // Mantém a referência sempre atual sem invalidar o `wrapped`.
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
      try {
        return await actionRef.current(...args);
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setIsLocked(false);
      }
    },
    []
  );

  return [wrapped, isLocked];
}

export default useActionLock;
