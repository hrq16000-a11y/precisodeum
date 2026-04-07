import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const AnimatedCounter = ({ value, duration = 1200, className = '', prefix = '', suffix = '' }: AnimatedCounterProps) => {
  const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const prevValue = useRef(0);

  useEffect(() => {
    if (!inView) return;
    const start = prevValue.current;
    prevValue.current = numericValue;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (numericValue - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [numericValue, inView, duration]);

  const formatted = typeof value === 'string' && value.includes('.')
    ? display.toFixed(1)
    : Math.round(display).toLocaleString('pt-BR');

  return (
    <motion.span
      ref={ref}
      className={`tabular-nums ${className}`}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.4, ease: 'easeOut' as const }}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
};

export default AnimatedCounter;
