import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { playAchievementSound, playConfettiPopSound } from '@/lib/celebrate';

interface DopamineCounterProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
  celebrateOnComplete?: boolean;
}

const DopamineCounter = ({ value, duration = 1200, className = '', suffix = ' pts', celebrateOnComplete = false }: DopamineCounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!inView) return;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }
      if (!doneRef.current && celebrateOnComplete) {
        doneRef.current = true;
        playConfettiPopSound(0.08);
        window.setTimeout(() => playAchievementSound(0.13), 80);
      }
    };
    requestAnimationFrame(tick);
  }, [celebrateOnComplete, duration, inView, value]);

  return (
    <motion.span
      ref={ref}
      className={`inline-block tabular-nums ${className}`}
      animate={inView ? { scale: [1, 1.08, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.55, repeat: inView && display < value ? Infinity : 0, repeatType: 'mirror' }}
    >
      {display.toLocaleString('pt-BR')}{suffix}
    </motion.span>
  );
};

export default DopamineCounter;