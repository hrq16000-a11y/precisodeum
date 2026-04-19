import { forwardRef, useRef, useImperativeHandle } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { ReactNode } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  /** Decorative background blur orb */
  orb?: boolean;
  orbColor?: string;
}

const ParallaxSection = forwardRef<HTMLDivElement, ParallaxSectionProps>(({
  children,
  className = '',
  speed = 0.15,
  orb = false,
  orbColor = 'primary',
}, forwardedRef) => {
  const ref = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [60 * speed, -60 * speed]);
  const orbY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const orbScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1.1, 0.8]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {orb && (
        <motion.div
          className={`pointer-events-none absolute -z-10 h-[400px] w-[400px] rounded-full opacity-[0.04] blur-3xl bg-${orbColor}`}
          style={{ y: orbY, scale: orbScale, left: '50%', top: '30%', translateX: '-50%' }}
        />
      )}
      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
});

ParallaxSection.displayName = 'ParallaxSection';

export default ParallaxSection;
