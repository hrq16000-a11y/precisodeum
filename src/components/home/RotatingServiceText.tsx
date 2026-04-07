import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SERVICES = [
  'técnico em informática',
  'eletricista',
  'encanador',
  'pedreiro',
  'pintor',
  'marido de aluguel',
  'instalador de ar-condicionado',
];

type AnimationType = 'fade' | 'slideUp' | 'typing';

const animations: Record<AnimationType, { initial: object; animate: object; exit: object }> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -24 },
  },
  typing: {
    initial: { opacity: 0, width: 0 },
    animate: { opacity: 1, width: 'auto' },
    exit: { opacity: 0, width: 0 },
  },
};

const ANIMATION_TYPES: AnimationType[] = ['fade', 'slideUp', 'typing'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RotatingServiceText = () => {
  const shuffled = useMemo(() => shuffle(SERVICES), []);
  const [index, setIndex] = useState(0);
  const [animType, setAnimType] = useState<AnimationType>(() =>
    ANIMATION_TYPES[Math.floor(Math.random() * ANIMATION_TYPES.length)]
  );

  const rotate = useCallback(() => {
    setIndex((prev) => (prev + 1) % shuffled.length);
    setAnimType(ANIMATION_TYPES[Math.floor(Math.random() * ANIMATION_TYPES.length)]);
  }, [shuffled.length]);

  useEffect(() => {
    const id = setInterval(rotate, 2500);
    return () => clearInterval(id);
  }, [rotate]);

  const anim = animations[animType];

  return (
    <>
      {/* Visible rotating text */}
      <span className="relative inline-block min-w-[180px] sm:min-w-[260px] text-left align-bottom">
        <AnimatePresence mode="wait">
          <motion.span
            key={`${index}-${animType}`}
            initial={anim.initial}
            animate={anim.animate}
            exit={anim.exit}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="text-secondary inline-block whitespace-nowrap"
          >
            {shuffled[index]}
          </motion.span>
        </AnimatePresence>
        <motion.span
          className="absolute -bottom-1 left-0 h-1 rounded-full bg-secondary/60"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
          key={index}
        />
      </span>

      {/* Hidden SEO block with all services */}
      <span className="sr-only" aria-hidden="false">
        {SERVICES.map((s) => (
          <span key={s}>{s}, </span>
        ))}
      </span>
    </>
  );
};

export default RotatingServiceText;
