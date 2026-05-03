import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useSubmitGuard — proteção universal contra double-submit.
 *
 * Diferente de um `loading` local em useState, o lock vive em um ref
 * (`inFlightRef`) que é imune a re-renders disparados por mudanças de
 * Context, props ou outros estados. Enquanto a Promise anterior estiver
 * pendente, novas chamadas são ignoradas IMEDIATAMENTE (early return),
 * sem efeitos colaterais.
 *
 * Retorno: `[isSubmitting, guardedSubmit]`
 *  - `isSubmitting`: boolean reativo para desabilitar botões/inputs.
 *  - `guardedSubmit`: envelope que executa a função apenas se nenhuma
 *    chamada anterior estiver em andamento. O lock é liberado em
 *    `finally`, garantindo destravamento mesmo em erro.
 */
export function useSubmitGuard<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
): [boolean, (...args: TArgs) => Promise<TResult | undefined>] {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  // Mantém referência à função sempre atualizada sem invalidar guardedSubmit.
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
      try {
        return await fnRef.current(...args);
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setIsSubmitting(false);
      }
    },
    [],
  );

  return [isSubmitting, guardedSubmit];
}

export default useSubmitGuard;
