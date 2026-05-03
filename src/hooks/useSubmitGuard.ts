import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSubmitGuardOptions {
  /** Tempo máximo (ms) antes de abortar a Promise e liberar o lock. Default: 15000. */
  timeoutMs?: number;
}

/**
 * useSubmitGuard — proteção universal contra double-submit com timeout forçado.
 *
 * O lock vive em um ref (`inFlightRef`), imune a re-renders disparados por
 * mudanças de Context/props. Enquanto a Promise anterior estiver pendente,
 * novas chamadas são ignoradas IMEDIATAMENTE.
 *
 * Para erradicar o deadlock do "Botão da Morte" (Promise que nunca resolve
 * por queda de rede sem timeout no fetch), envolvemos a chamada em um
 * `Promise.race` contra um timer. Se o timeout dispara primeiro, a action
 * rejeita com `Error('TIMEOUT')`, o `finally` destrava o botão e o erro
 * propaga para o chamador exibir feedback.
 *
 * Retorno: `[isSubmitting, guardedSubmit]`.
 */
export function useSubmitGuard<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  options: UseSubmitGuardOptions = {},
): [boolean, (...args: TArgs) => Promise<TResult | undefined>] {
  const { timeoutMs = 15000 } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const guardedSubmit = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      if (mountedRef.current) setIsSubmitting(true);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const actionPromise = Promise.resolve().then(() => fnRef.current(...args));
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
        });
        return (await Promise.race([actionPromise, timeoutPromise])) as TResult;
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        inFlightRef.current = false;
        if (mountedRef.current) setIsSubmitting(false);
      }
    },
    [timeoutMs],
  );

  return [isSubmitting, guardedSubmit];
}

export default useSubmitGuard;
