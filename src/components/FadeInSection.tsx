import { motion } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

interface FadeInSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
  scale?: boolean;
  blur?: boolean;
  /** Use viewport-triggered animation instead of mount-triggered */
  viewportTrigger?: boolean;
  /** Viewport margin for earlier trigger */
  viewportMargin?: string;
}

const directionMap = {
  up: { y: 40, x: 0 },
  down: { y: -40, x: 0 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
  none: { x: 0, y: 0 },
};

const FadeInSection = forwardRef<HTMLDivElement, FadeInSectionProps>(({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = 0.6,
  scale = false,
  blur = true,
  viewportTrigger = false,
  viewportMargin = '-40px',
}, ref) => {
  const offset = directionMap[direction];

  const initial = {
    opacity: 0,
    ...offset,
    ...(scale ? { scale: 0.95 } : {}),
    ...(blur ? { filter: 'blur(8px)' } : {}),
  };

  const visible = {
    opacity: 1,
    x: 0,
    y: 0,
    ...(scale ? { scale: 1 } : {}),
    ...(blur ? { filter: 'blur(0px)' } : {}),
  };

  const animateProps = viewportTrigger
    ? { whileInView: visible, viewport: { once: true, margin: viewportMargin } }
    : { animate: visible };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      {...animateProps}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

FadeInSection.displayName = 'FadeInSection';

export default FadeInSection;
