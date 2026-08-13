import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeletons padronizados para as formas mais comuns do sistema.
 * Sempre com `role="status"` + `aria-live="polite"` → leitores de tela
 * anunciam o carregamento em vez de encontrar tela vazia.
 */

const Status = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div role="status" aria-live="polite" aria-busy="true" aria-label={label} className="motion-enter-fade">
    {children}
    <span className="sr-only">{label}</span>
  </div>
);

export const SkeletonText = ({ lines = 3, className }: { lines?: number; className?: string }) => (
  <Status label="Carregando texto">
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4 w-full', i === lines - 1 && 'w-2/3')} />
      ))}
    </div>
  </Status>
);

export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('space-y-3 rounded-xl border border-border/60 p-4', className)}>
    <Skeleton className="h-32 w-full rounded-lg" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);

export const SkeletonCardGrid = ({ count = 6, className }: { count?: number; className?: string }) => (
  <Status label="Carregando itens">
    <div className={cn('grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </Status>
);

export const SkeletonList = ({ count = 5, className }: { count?: number; className?: string }) => (
  <Status label="Carregando lista">
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  </Status>
);

export const SkeletonTable = ({
  rows = 6,
  columns = 4,
  className,
}: { rows?: number; columns?: number; className?: string }) => (
  <Status label="Carregando tabela">
    <div className={cn('overflow-hidden rounded-lg border border-border/60', className)}>
      <div className="flex gap-4 border-b border-border/60 bg-muted/40 p-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border/40 p-3 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  </Status>
);

export const SkeletonForm = ({ fields = 4, className }: { fields?: number; className?: string }) => (
  <Status label="Carregando formulário">
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="h-11 w-40 rounded-md" />
    </div>
  </Status>
);
