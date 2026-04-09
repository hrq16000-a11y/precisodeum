import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface TextRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

const TextReveal = ({ children, className = '', delay = 0, as: Tag = 'span' }: TextRevealProps) => {
  const MotionTag = motion.create(Tag);

  return (
    <span className="inline-block overflow-hidden">
      <MotionTag
        initial={{ y: '100%', opacity: 0 }}
        whileInView={{ y: '0%', opacity: 1 }}
        viewport={{ once: true, margin: '-30px' }}
        transition={{
          duration: 0.6,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className={`inline-block ${className}`}
      >
        {children}
      </MotionTag>
    </span>
  );
};

export default TextReveal;
