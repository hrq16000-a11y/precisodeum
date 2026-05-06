import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MousePointerClick, BarChart3, TrendingUp } from 'lucide-react';

const SponsorMetricsPage = () => {
  const { sponsor, loading } = useSponsorAuth();

  if (loading) {
    return (
      <SponsorLayout>
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
      </SponsorLayout>
    );
  }

  const impressions = sponsor?.impressions || 0;
  const clicks = sponsor?.clicks || 0;
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Métricas</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Impressões</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{impressions.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Cliques</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{clicks.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Cliques (CTR)</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{ctr}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sponsor?.active ? '🟢' : '🔴'}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {sponsor?.active ? 'Campanha ativa' : 'Campanha pausada'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Gráficos detalhados e histórico de métricas serão disponibilizados na Fase 2.
            </p>
          </CardContent>
        </Card>
      </div>
    </SponsorLayout>
  );
};

export default SponsorMetricsPage;
