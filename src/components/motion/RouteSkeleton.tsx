import { useEffect, useState } from 'react';
import ProgressIndicator from './ProgressIndicator';
import { SkeletonCardGrid } from './Skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Fallback de rota: barra de progresso imediata + skeleton de conteúdo
 * só depois de 220ms (evita "flash" em navegações instantâneas / prefetch).
 */
const RouteSkeleton = () => {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowSkeleton(true), 220);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Carregando página">
      <ProgressIndicator fixed label="Carregando página" />

      {showSkeleton && (
        <div className="route-motion-enter mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-1/2 max-w-sm" />
          <SkeletonCardGrid count={6} />
        </div>
      )}
      <span className="sr-only">Carregando conteúdo…</span>
    </div>
  );
};

export default RouteSkeleton;
