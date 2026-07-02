import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

interface StaggeredListProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (custom: { stagger: number; delayChildren: number }) => ({
    opacity: 1,
    transition: {
      staggerChildren: custom.stagger,
      delayChildren: custom.delayChildren,
    },
  }),
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const StaggeredList = ({
  children,
  className = '',
  stagger = 0.07,
  delayChildren = 0.1,
}: StaggeredListProps) => (
  <motion.div
    variants={containerVariants}
    custom={{ stagger, delayChildren }}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-50px' }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggeredItem = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.div variants={staggerItemVariants} className={className}>
    {children}
  </motion.div>
);

export default StaggeredList;
