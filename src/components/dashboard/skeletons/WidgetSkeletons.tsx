/**
 * WidgetSkeletons — placeholders específicos por área do Dashboard.
 *
 * Em vez de um único skeleton global (DashboardSkeleton) cobrindo a tela,
 * cada widget pode renderizar seu próprio esqueleto enquanto carrega seus
 * dados. Isso reduz a percepção de "tela inteira piscando" e mantém o
 * layout estável (sem CLS) por widget.
 *
 * Categorias:
 *  - LeadsWidgetSkeleton       → cards/listas de leads e métricas relacionadas
 *  - ResultsWidgetSkeleton     → gráficos, conversão, performance
 *  - SetupWidgetSkeleton       → checklists, próximos passos, configuração
 */
import { Skeleton } from '@/components/ui/skeleton';

const Row = ({ widthClass = 'w-2/3' }: { widthClass?: string }) => (
  <div className="flex items-center gap-3">
    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
    <div className="flex-1 space-y-1.5 min-w-0">
      <Skeleton className={`h-3.5 ${widthClass}`} />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <Skeleton className="h-7 w-16 rounded-md" />
  </div>
);

export const LeadsWidgetSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div
    className="rounded-2xl border border-border bg-card p-4 space-y-3"
    role="status"
    aria-busy="true"
    aria-label="Carregando leads"
  >
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Row key={i} widthClass={i % 2 === 0 ? 'w-2/3' : 'w-3/4'} />
      ))}
    </div>
    <span className="sr-only">Carregando leads…</span>
  </div>
);

export const ResultsWidgetSkeleton = () => (
  <div
    className="rounded-2xl border border-border bg-card p-4 space-y-3"
    role="status"
    aria-busy="true"
    aria-label="Carregando resultados"
  >
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    {/* Linha de KPIs */}
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border/60 p-3 space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
    {/* Gráfico */}
    <Skeleton className="h-32 w-full rounded-xl" />
    <span className="sr-only">Carregando resultados…</span>
  </div>
);

export const SetupWidgetSkeleton = ({ items = 4 }: { items?: number }) => (
  <div
    className="rounded-2xl border-2 border-accent/20 bg-card p-4 space-y-3"
    role="status"
    aria-busy="true"
    aria-label="Carregando próximos passos"
  >
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
    <div className="space-y-2 pt-1">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
        </div>
      ))}
    </div>
    <Skeleton className="h-9 w-full sm:w-44 rounded-md" />
    <span className="sr-only">Carregando próximos passos…</span>
  </div>
);

export default {
  LeadsWidgetSkeleton,
  ResultsWidgetSkeleton,
  SetupWidgetSkeleton,
};
