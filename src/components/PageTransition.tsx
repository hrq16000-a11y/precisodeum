import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Transição de página CSS-only (sem framer-motion).
 * Usa a mesma curva/duração da camada global de motion (RouteMotion)
 * e respeita `prefers-reduced-motion` via index.css.
 */
const PageTransition = ({ children, className = '' }: PageTransitionProps) => (
  <div className={`route-motion-enter ${className}`}>
    {children}
  </div>
);

export default PageTransition;
