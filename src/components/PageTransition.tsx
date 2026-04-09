import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const pageVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition = {
  type: 'tween' as const,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
  duration: 0.4,
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const PageTransition = ({ children, className = '' }: PageTransitionProps) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="enter"
    exit="exit"
    transition={pageTransition}
    className={className}
  >
    {children}
  </motion.div>
);

export default PageTransition;
