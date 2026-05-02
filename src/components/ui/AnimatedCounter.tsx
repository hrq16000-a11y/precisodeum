/**
 * AnimatedCounter — contador com easing cubic-out animado quando entra
 * em viewport, usando `useInView` do framer-motion.
 *
 * Implementado com `forwardRef` para blindar contra o warning
 *   "Function components cannot be given refs"
 * que aparecia quando consumidores (ex.: TooltipTrigger asChild,
 * Slot do Radix, etc.) tentavam injetar um ref via `React.cloneElement`.
 *
 * O ref externo é encaminhado para o `motion.span` final via
 * `useMergedRef`, mantendo o ref interno usado por `useInView`.
 */
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

export interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/** Combina dois refs (interno + externo encaminhado). */
function useMergedRef<T>(...refs: Array<React.Ref<T> | undefined>) {
  return useCallback((node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refs);
}

const AnimatedCounter = forwardRef<HTMLSpanElement, AnimatedCounterProps>(
  function AnimatedCounter(
    { value, duration = 1200, className = '', prefix = '', suffix = '' },
    forwardedRef,
  ) {
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    const safeNumeric = Number.isFinite(numericValue) ? numericValue : 0;
    const [display, setDisplay] = useState(0);
    const innerRef = useRef<HTMLSpanElement>(null);
    const mergedRef = useMergedRef<HTMLSpanElement>(innerRef, forwardedRef);
    const inView = useInView(innerRef, { once: true, margin: '-50px' });
    const prevValue = useRef(0);

    useEffect(() => {
      if (!inView) return;
      let cancelled = false;
      const start = prevValue.current;
      prevValue.current = safeNumeric;
      const startTime = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(start + (safeNumeric - start) * eased);
        if (progress < 1) requestAnimationFrame(tick);
      };

      const handle = requestAnimationFrame(tick);
      return () => {
        cancelled = true;
        cancelAnimationFrame(handle);
      };
    }, [safeNumeric, inView, duration]);

    const formatted =
      typeof value === 'string' && value.includes('.')
        ? display.toFixed(1)
        : Math.round(display).toLocaleString('pt-BR');

    return (
      <motion.span
        ref={mergedRef}
        className={`tabular-nums ${className}`}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.4, ease: 'easeOut' as const }}
      >
        {prefix}
        {formatted}
        {suffix}
      </motion.span>
    );
  },
);

export default AnimatedCounter;
