import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Briefcase, Camera, Eye, Megaphone, MessageCircle, MessageSquare, Phone, Star, TrendingUp } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardGroupNav from '@/components/dashboard/DashboardGroupNav';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProviderCounters } from '@/hooks/useProviderCounters';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import ContactImpactWidget from '@/components/dashboard/ContactImpactWidget';
import DashboardAnalytics from '@/components/dashboard/DashboardAnalytics';
import AdPerformanceWidget from '@/components/dashboard/AdPerformanceWidget';
import ImpactSection from '@/components/dashboard/ImpactSection';
import StatCardGrid from '@/components/dashboard/StatCardGrid';

// Lazy: pesado (Recharts + múltiplos cards). Só monta quando há dados reais.
const ProviderAnalyticsGrid = lazy(() => import('@/pages/dashboard/sections/ProviderAnalyticsGrid'));

interface LeadStatsDay {
  label: string;
  date: string;
  views: number;
  whatsapp_clicks: number;
  phone_clicks: number;
}

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '14 dias', value: 14 },
  { label: '30 dias', value: 30 },
] as const;

const DashboardMetricsPage = () => {
  const { provider, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>(30);
  const [series, setSeries] = useState<LeadStatsDay[]>([]);
  const [loading, setLoading] = useState(true);

  // Contadores agregados (movidos da home do Dashboard) — agora via hook compartilhado
  const {
    servicesCount,
    leadsCount,
    jobsCount,
    portfolioCount,
    viewsTotal,
    reviewCount,
  } = useProviderCounters();

  useEffect(() => {
    if (authLoading) return;
    if (!provider?.id) {
      setSeries([]);
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.rpc as any)('get_lead_stats', { provider_id: provider.id });
      if (!active) return;

      const rows = ((data as any)?.series || []).map((row: any) => ({
        label: String(row.label || ''),
        date: String(row.date || ''),
        views: Number(row.views) || 0,
        whatsapp_clicks: Number(row.whatsapp_clicks) || 0,
        phone_clicks: Number(row.phone_clicks) || 0,
      }));

      setSeries(rows);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [authLoading, provider?.id]);



  const chartData = useMemo(() => series.slice(-period).map((day) => ({
    ...day,
    contacts: day.whatsapp_clicks + day.phone_clicks,
  })), [series, period]);

  const totals = useMemo(() => chartData.reduce((acc, day) => ({
    views: acc.views + day.views,
    whatsapp: acc.whatsapp + day.whatsapp_clicks,
    phone: acc.phone + day.phone_clicks,
    contacts: acc.contacts + day.contacts,
  }), { views: 0, whatsapp: 0, phone: 0, contacts: 0 }), [chartData]);

  const conversion = totals.views > 0 ? Math.round((totals.contacts / totals.views) * 100) : 0;
  const hasData = totals.views > 0 || totals.contacts > 0;

  const statCards = [
    { icon: Briefcase, value: servicesCount, label: servicesCount === 0 ? 'Nenhum serviço' : 'Serviços', gradient: 'from-amber-500/10 to-orange-600/5', iconColor: 'text-amber-500' },
    { icon: MessageSquare, value: leadsCount, label: leadsCount === 0 ? 'Nenhum lead' : 'Leads', gradient: 'from-orange-500/10 to-orange-600/5', iconColor: 'text-orange-500' },
    { icon: TrendingUp, value: viewsTotal, label: viewsTotal === 0 ? 'Sem visualizações' : 'Visualizações', gradient: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-500' },
    { icon: Star, value: provider?.rating_avg ? Number(provider.rating_avg).toFixed(1) : '0', label: !provider?.rating_avg || Number(provider.rating_avg) === 0 ? 'Sem avaliações' : `${reviewCount} avaliação${reviewCount !== 1 ? 'ões' : ''}`, gradient: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-500' },
    { icon: Camera, value: portfolioCount, label: portfolioCount === 0 ? 'Sem fotos' : 'Portfólio', gradient: 'from-orange-500/10 to-emerald-600/5', iconColor: 'text-orange-500' },
    { icon: Megaphone, value: jobsCount, label: jobsCount === 0 ? 'Nenhuma vaga' : 'Vagas', gradient: 'from-amber-500/10 to-orange-600/5', iconColor: 'text-amber-500' },
  ];

  const hasAnyCounter = servicesCount + leadsCount + viewsTotal + portfolioCount + jobsCount + reviewCount > 0;

  return (
    <DashboardLayout>
      <DashboardGroupNav />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BarChart3 className="h-3.5 w-3.5" /> Métricas do perfil
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Resultados por período</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe visualizações, contatos e desempenho da sua vitrine.</p>
        </div>

        <div className="flex rounded-xl border border-border bg-card p-1">
          {PERIODS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={period === item.value ? 'default' : 'ghost'}
              className="rounded-lg text-xs"
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Eye} label="Visualizações" value={totals.views} />
            <MetricCard icon={MessageCircle} label="Cliques no WhatsApp" value={totals.whatsapp} />
            <MetricCard icon={Phone} label="Cliques no telefone" value={totals.phone} />
            <MetricCard icon={TrendingUp} label="Conversão" value={conversion} suffix="%" />
          </div>

          <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Evolução diária</h2>
                <p className="text-xs text-muted-foreground">Views e contatos por dia nos últimos {period} dias.</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" /> Views</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent" /> Contatos</span>
              </div>
            </div>

            {hasData ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                    <Line type="monotone" dataKey="views" name="Views" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3, fill: 'hsl(var(--primary))' }} />
                    <Line type="monotone" dataKey="contacts" name="Contatos" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 3, fill: 'hsl(var(--accent))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-center">
                <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/70" />
                <p className="font-semibold text-foreground">Sem dados neste período</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Compartilhe sua página pública para começar a registrar visualizações e contatos.</p>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
            <h2 className="mb-4 font-display text-lg font-bold text-foreground">Detalhamento por canal</h2>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="whatsapp_clicks" name="WhatsApp" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="phone_clicks" name="Telefone" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Contadores gerais (movidos da home) */}
          {hasAnyCounter && (
            <section className="mt-6">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">Visão geral do perfil</h2>
              <StatCardGrid cards={statCards as any} />
            </section>
          )}

          {/* Impacto 24h + Impacto na rede */}
          <section className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
            <ContactImpactWidget />
            <ImpactSection
              views={viewsTotal}
              whatsappClicks={(provider as any)?.contact_clicks_count ?? 0}
              leads={leadsCount}
            />
          </section>

          {/* Insights detalhados + desempenho do anúncio */}
          <section className="mt-6">
            <DashboardAnalytics />
          </section>

          {provider?.id && (
            <section className="mt-4">
              <AdPerformanceWidget providerId={provider.id} hasPhoto={!!provider?.photo_url} />
            </section>
          )}

          {/* Analytics grid pesado — só com dados reais */}
          {provider && (viewsTotal > 0 || leadsCount > 0) && (
            <Suspense fallback={<Skeleton className="mt-6 h-[360px] rounded-xl" />}>
              <ProviderAnalyticsGrid
                providerId={provider.id}
                viewsTotal={viewsTotal}
                leadsCount={leadsCount}
                servicesCount={servicesCount}
              />
            </Suspense>
          )}
        </>
      )}
    </DashboardLayout>
  );
};

const MetricCard = ({ icon: Icon, label, value, suffix = '' }: { icon: typeof Eye; label: string; value: number; suffix?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-card">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="mt-1 flex items-baseline gap-1">
      <AnimatedCounter value={value} className="font-display text-3xl font-bold leading-none text-foreground" />
      {suffix && <span className="font-display text-xl font-bold text-foreground">{suffix}</span>}
    </div>
  </div>
);

export default DashboardMetricsPage;
