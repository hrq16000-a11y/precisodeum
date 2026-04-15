import { useMemo } from 'react';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, MousePointerClick, BarChart3, TrendingUp, MapPin, Tag, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { exportSponsorPdf } from '@/lib/exportSponsorPdf';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SponsorMetricsPage = () => {
  const { sponsor, loading } = useSponsorAuth();

  const { data: metrics = [] } = useQuery({
    queryKey: ['sponsor-metrics-detail', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_metrics')
        .select('event_type, event_date, slot_slug, page_path, count')
        .eq('sponsor_id', sponsor!.id)
        .gte('event_date', subDays(new Date(), 30).toISOString().split('T')[0])
        .order('event_date', { ascending: true });
      return (data || []) as Array<{
        event_type: string;
        event_date: string;
        slot_slug: string;
        page_path: string | null;
        count: number;
      }>;
    },
    staleTime: 1000 * 60 * 2,
  });

  // --- Daily chart data (last 30 days) ---
  const dailyData = useMemo(() => {
    const map: Record<string, { impressions: number; clicks: number }> = {};
    // Pre-fill last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      map[d] = { impressions: 0, clicks: 0 };
    }
    metrics.forEach(m => {
      const d = m.event_date;
      if (!map[d]) map[d] = { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') map[d].impressions += m.count;
      else if (m.event_type === 'click') map[d].clicks += m.count;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
        rawDate: date,
        ...vals,
      }));
  }, [metrics]);

  // --- Ranking by slot (proxy for position/page) ---
  const slotRanking = useMemo(() => {
    const map: Record<string, { impressions: number; clicks: number }> = {};
    metrics.forEach(m => {
      const key = m.slot_slug || 'outros';
      if (!map[key]) map[key] = { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') map[key].impressions += m.count;
      else if (m.event_type === 'click') map[key].clicks += m.count;
    });
    return Object.entries(map)
      .map(([name, vals]) => ({ name, ...vals }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 8);
  }, [metrics]);

  // --- Ranking by page_path (proxy for city/category pages) ---
  const pageRanking = useMemo(() => {
    const map: Record<string, { impressions: number; clicks: number }> = {};
    metrics.forEach(m => {
      const path = m.page_path || '/';
      // Clean path for display
      const label = path === '/' ? 'Home' : path.replace(/^\//, '').replace(/-/g, ' ').slice(0, 30);
      if (!map[label]) map[label] = { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') map[label].impressions += m.count;
      else if (m.event_type === 'click') map[label].clicks += m.count;
    });
    return Object.entries(map)
      .map(([name, vals]) => ({ name, ...vals }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 8);
  }, [metrics]);

  if (loading) {
    return (
      <SponsorLayout>
        <div className="space-y-6">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </SponsorLayout>
    );
  }

  const impressions = sponsor?.impressions || 0;
  const clicks = sponsor?.clicks || 0;
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

  const totalPeriodImpressions = dailyData.reduce((s, d) => s + d.impressions, 0);
  const totalPeriodClicks = dailyData.reduce((s, d) => s + d.clicks, 0);

  const kpis = [
    { title: 'Impressões (Total)', value: impressions.toLocaleString('pt-BR'), icon: Eye },
    { title: 'Cliques (Total)', value: clicks.toLocaleString('pt-BR'), icon: MousePointerClick },
    { title: 'CTR Geral', value: `${ctr}%`, icon: BarChart3 },
    {
      title: 'Últimos 30 dias',
      value: totalPeriodImpressions.toLocaleString('pt-BR'),
      icon: TrendingUp,
      sub: `${totalPeriodClicks} cliques`,
    },
  ];

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <motion.h1
            className="text-2xl font-bold text-foreground"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            Métricas
          </motion.h1>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportSponsorPdf({
              sponsorName: sponsor?.company_name || sponsor?.contact_name || 'Patrocinador',
              plan: sponsor?.plan || 'standard',
              totalImpressions: impressions,
              totalClicks: clicks,
              ctr,
              periodImpressions: totalPeriodImpressions,
              periodClicks: totalPeriodClicks,
              slotRanking,
              pageRanking,
              dailyData: dailyData.map(d => ({ date: d.date, impressions: d.impressions, clicks: d.clicks })),
            })}
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <Card className="transition-shadow hover:shadow-card-hover">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{m.value}</div>
                    {m.sub && <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Daily impressions/clicks chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Impressões e Cliques por Dia (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalPeriodImpressions === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma métrica registrada nos últimos 30 dias.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="gradImpr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradClick" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="impressions"
                      name="Impressões"
                      stroke="hsl(var(--primary))"
                      fill="url(#gradImpr)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      name="Cliques"
                      stroke="hsl(var(--accent))"
                      fill="url(#gradClick)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Rankings row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Ranking by Slot */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Ranking por Posição/Slot
                </CardTitle>
              </CardHeader>
              <CardContent>
                {slotRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={slotRanking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="impressions" name="Impressões" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="clicks" name="Cliques" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Ranking by Page */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Ranking por Página/Cidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pageRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={pageRanking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="impressions" name="Impressões" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="clicks" name="Cliques" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </SponsorLayout>
  );
};

export default SponsorMetricsPage;
