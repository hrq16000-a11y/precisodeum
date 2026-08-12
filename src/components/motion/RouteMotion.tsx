import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Camada global de motion entre rotas.
 *
 * Motion principles aplicados:
 *  - entrada curta (220ms) com deslocamento mínimo (6px) → sem CLS perceptível;
 *  - easing "ease-out" (rápido no início, suave no fim);
 *  - 100% CSS (sem framer-motion) para não pesar no bundle;
 *  - respeita `prefers-reduced-motion` (classe some via media query em index.css).
 */
const RouteMotion = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="route-motion-enter">
      {children}
    </div>
  );
};

export default RouteMotion;
