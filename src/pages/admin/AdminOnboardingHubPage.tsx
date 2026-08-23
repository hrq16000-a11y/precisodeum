import { lazy, Suspense } from 'react';
import { useNavigate, useParams, Navigate } from '@/lib/router-compat';
import { Telescope, BarChart3, LineChart, Activity, Bug } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * AdminOnboardingHubPage
 * ----------------------
 * Hub unificado de Onboarding Ops. Cada tab importa a página admin
 * existente sem duplicar código nem remover funcionalidade.
 *
 * Observação: o nome do arquivo é "Hub" (não "Ops") para evitar colisão
 * com `AdminOnboardingOpsPage.tsx` que continua existindo e é renderizada
 * dentro da tab "ops". A rota pública é `/admin/onboarding-ops/:tab?`.
 */
const AdminOnboardingOpsPage = lazy(() => import('./AdminOnboardingOpsPage'));
const AdminOnboardingFunnelPage = lazy(() => import('../AdminOnboardingFunnelPage'));
const AdminOnboardingStatsPage = lazy(() => import('./AdminOnboardingStatsPage'));
const AdminOnboardingRegressionPage = lazy(() => import('./AdminOnboardingRegressionPage'));
const AdminWizardDiagnosticsPage = lazy(() => import('../AdminWizardDiagnosticsPage'));

const TABS = [
  { value: 'ops', label: 'Ops (avançado)', icon: Telescope, Component: AdminOnboardingOpsPage },
  { value: 'funnel', label: 'Funil', icon: BarChart3, Component: AdminOnboardingFunnelPage },
  { value: 'stats', label: 'Estatísticas', icon: LineChart, Component: AdminOnboardingStatsPage },
  { value: 'regression', label: 'Regression Watch', icon: Activity, Component: AdminOnboardingRegressionPage },
  { value: 'wizard-debug', label: 'Wizard Debug', icon: Bug, Component: AdminWizardDiagnosticsPage },
] as const;

const DEFAULT_TAB = TABS[0].value;

const AdminOnboardingHubPage = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  if (!tab) return <Navigate to={`/admin/onboarding-ops/${DEFAULT_TAB}`} replace />;
  const active = TABS.find((t) => t.value === tab);
  if (!active) return <Navigate to={`/admin/onboarding-ops/${DEFAULT_TAB}`} replace />;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Onboarding Ops</h1>
        <p className="text-sm text-muted-foreground">
          Hub unificado: funil, estatísticas, regression watch, debug do wizard e console operacional avançado.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate(`/admin/onboarding-ops/${v}`, { replace: false })}
        className="space-y-4"
      >
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ value, Component }) => (
          <TabsContent key={value} value={value} className="mt-2">
            {value === tab && (
              <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-md" />}>
                <Component />
              </Suspense>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminOnboardingHubPage;
