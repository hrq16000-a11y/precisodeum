import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MousePointerClick, BarChart3, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const SponsorMetricsPage = () => {
  const { sponsor, loading } = useSponsorAuth();

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

  const metrics = [
    { title: 'Total Impressões', value: impressions.toLocaleString('pt-BR'), icon: Eye },
    { title: 'Total Cliques', value: clicks.toLocaleString('pt-BR'), icon: MousePointerClick },
    { title: 'Taxa de Cliques (CTR)', value: `${ctr}%`, icon: BarChart3 },
    { title: 'Status', value: sponsor?.active ? '🟢' : '🔴', icon: TrendingUp, sub: sponsor?.active ? 'Campanha ativa' : 'Campanha pausada' },
  ];

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          Métricas
        </motion.h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Gráficos detalhados e histórico de métricas serão disponibilizados na Fase 2.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </SponsorLayout>
  );
};

export default SponsorMetricsPage;
