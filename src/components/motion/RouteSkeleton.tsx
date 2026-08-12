import { useEffect, useState } from 'react';
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
    <div role="status" aria-live="polite" aria-label="Carregando página">
      <div className="fixed left-0 right-0 top-0 z-[9999] h-0.5 overflow-hidden bg-transparent">
        <div className="h-full w-1/3 animate-[routeProgress_1.1s_ease-in-out_infinite] bg-primary/70" />
        <style>{`@keyframes routeProgress{0%{transform:translateX(-100%)}60%{transform:translateX(180%)}100%{transform:translateX(320%)}}`}</style>
      </div>

      {showSkeleton && (
        <div className="route-motion-enter mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-1/2 max-w-sm" />
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-border/60 p-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}
      <span className="sr-only">Carregando conteúdo…</span>
    </div>
  );
};

export default RouteSkeleton;
