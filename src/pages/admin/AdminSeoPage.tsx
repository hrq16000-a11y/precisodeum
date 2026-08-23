import { lazy, Suspense } from 'react';
import { useNavigate, useParams, Navigate } from '@/lib/router-compat';
import { Globe, Activity, Map, BarChart2, Tags, LinkIcon, Search, Send } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * AdminSeoPage
 * ------------
 * Hub unificado de SEO/conteúdo programático. Cada tab importa a página
 * admin existente — ZERO código duplicado, ZERO funcionalidade removida.
 * As rotas antigas continuam funcionando via aliases (ver adminRoutes.tsx).
 */
const AdminSeoLandingsPage = lazy(() => import('./AdminSeoLandingsPage'));
const AdminSeoHealthPage = lazy(() => import('./AdminSeoHealthPage'));
const AdminSeoRuntimeMetricsPage = lazy(() => import('./AdminSeoRuntimeMetricsPage'));
const AdminSitemapAuditPage = lazy(() => import('./AdminSitemapAuditPage'));
const AdminMetaTrackingQualityPage = lazy(() => import('./AdminMetaTrackingQualityPage'));
const AdminMetaTagsPage = lazy(() => import('../AdminMetaTagsPage'));
const AdminBrokenLinksPage = lazy(() => import('./AdminBrokenLinksPage'));
const AdminSeoGscPage = lazy(() => import('./AdminSeoGscPage'));
const AdminGscSubmissionsPage = lazy(() => import('./AdminGscSubmissionsPage'));
const AdminSeoMetricsPage = lazy(() => import('./AdminSeoMetricsPage'));
const AdminWebVitalsPage = lazy(() => import('./AdminWebVitalsPage'));
const AdminAnalyticsSettingsPage = lazy(() => import('./AdminAnalyticsSettingsPage'));


const TABS = [
  { value: 'saude', label: 'Saúde SEO', icon: Activity, Component: AdminSeoHealthPage },
  { value: 'landings', label: 'Landings', icon: Globe, Component: AdminSeoLandingsPage },
  { value: 'runtime', label: 'Runtime (LCP/CTR)', icon: Activity, Component: AdminSeoRuntimeMetricsPage },
  { value: 'sitemap', label: 'Sitemap', icon: Map, Component: AdminSitemapAuditPage },
  { value: 'gsc', label: 'Search Console', icon: Search, Component: AdminSeoGscPage },
  { value: 'submissoes', label: 'Submissões GSC', icon: Send, Component: AdminGscSubmissionsPage },
  { value: 'metricas', label: 'Métricas GSC (7d)', icon: BarChart2, Component: AdminSeoMetricsPage },
  { value: 'web-vitals', label: 'Core Web Vitals', icon: Activity, Component: AdminWebVitalsPage },
  { value: 'meta-tracking', label: 'Meta Tracking', icon: BarChart2, Component: AdminMetaTrackingQualityPage },
  { value: 'analytics', label: 'Analytics (GA4/GTM)', icon: BarChart2, Component: AdminAnalyticsSettingsPage },


  { value: 'metatags', label: 'Meta Tags', icon: Tags, Component: AdminMetaTagsPage },
  { value: 'broken-links', label: 'Links Quebrados', icon: LinkIcon, Component: AdminBrokenLinksPage },
] as const;

const DEFAULT_TAB = TABS[0].value;


const AdminSeoPage = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  if (!tab) return <Navigate to={`/admin/seo/${DEFAULT_TAB}`} replace />;
  const active = TABS.find((t) => t.value === tab);
  if (!active) return <Navigate to={`/admin/seo/${DEFAULT_TAB}`} replace />;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">SEO &amp; Conteúdo Programático</h1>
        <p className="text-sm text-muted-foreground">
          Hub unificado: landings, sitemap, meta tags, qualidade de tracking e links quebrados.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate(`/admin/seo/${v}`, { replace: false })}
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

export default AdminSeoPage;
