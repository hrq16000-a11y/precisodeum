import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/** Lightweight page transition using CSS only — avoids framer-motion reflow */
const PageTransition = ({ children, className = '' }: PageTransitionProps) => (
  <div className={`animate-fade-in ${className}`}>
    {children}
  </div>
);

export default PageTransition;
