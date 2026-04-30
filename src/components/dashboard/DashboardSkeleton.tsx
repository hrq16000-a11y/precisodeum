/**
 * DashboardSkeleton — placeholder coerente com o layout real do Dashboard,
 * usado enquanto `useAuth().loading` é `true`. Evita o "flash" de
 * "Carregando..." e mantém percepção de fluidez (Apple-like).
 *
 * Estrutura espelha grosseiramente:
 *  - Bar de identidade (chip + ações)
 *  - Hero/Welcome
 *  - Linha de stats (4 cards)
 *  - Card "Próximo passo" largo
 *  - 2 colunas de widgets
 */
import { Skeleton } from '@/components/ui/skeleton';

const StatBlock = () => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
    <Skeleton className="h-3 w-16" />
    <Skeleton className="h-7 w-20" />
    <Skeleton className="h-3 w-24" />
  </div>
);

const WidgetBlock = ({ tall = false }: { tall?: boolean }) => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <Skeleton className={tall ? 'h-32 w-full' : 'h-20 w-full'} />
    <div className="flex gap-2">
      <Skeleton className="h-8 flex-1" />
      <Skeleton className="h-8 w-20" />
    </div>
  </div>
);

const DashboardSkeleton = () => {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Carregando seu painel"
    >
      {/* Identity bar */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </div>

      {/* Hero / Welcome */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock />
        <StatBlock />
        <StatBlock />
        <StatBlock />
      </div>

      {/* Next step CTA (largo) */}
      <div className="rounded-2xl border-2 border-accent/20 bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden sm:block h-10 w-40 rounded-md" />
        </div>
      </div>

      {/* Widgets grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WidgetBlock tall />
        <WidgetBlock />
        <WidgetBlock />
        <WidgetBlock tall />
      </div>

      <span className="sr-only">Carregando seu painel…</span>
    </div>
  );
};

export default DashboardSkeleton;
