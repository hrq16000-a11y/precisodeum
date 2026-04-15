import { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, Eye, MousePointerClick, Image, FileText, Megaphone,
  TrendingUp, ArrowRight, Bell, Crown, Calendar, CheckCircle2,
  AlertTriangle, Upload, Zap, FileDown
} from 'lucide-react';
import { exportSponsorPdf } from '@/lib/exportSponsorPdf';
import { SponsorImage } from '@/components/SponsorImage';
import { motion } from 'framer-motion';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SponsorDashboardPage = () => {
  const { sponsor, sponsorContact, loading } = useSponsorAuth();

  const { data: campaigns = [] } = useQuery({
    queryKey: ['sponsor-campaigns', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_campaigns')
        .select('*')
        .eq('sponsor_id', sponsor!.id)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['sponsor-contracts', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_contracts' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id);
      return (data || []) as any[];
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['sponsor-notifications-unread', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_notifications' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // Recent metrics (last 7 days)
  const { data: recentMetrics = [] } = useQuery({
    queryKey: ['sponsor-recent-metrics', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from('sponsor_metrics')
        .select('event_type, count')
        .eq('sponsor_id', sponsor!.id)
        .gte('event_date', since.toISOString().split('T')[0]);
      return (data || []) as Array<{ event_type: string; count: number }>;
    },
  });

  // Full 30-day metrics for PDF export
  const { data: fullMetrics = [] } = useQuery({
    queryKey: ['sponsor-full-metrics', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from('sponsor_metrics')
        .select('event_type, event_date, slot_slug, page_path, count')
        .eq('sponsor_id', sponsor!.id)
        .gte('event_date', since.toISOString().split('T')[0])
        .order('event_date', { ascending: true });
      return (data || []) as Array<{ event_type: string; event_date: string; slot_slug: string; page_path: string | null; count: number }>;
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleExportPdf = useCallback(() => {
    const dayMap: Record<string, { impressions: number; clicks: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(new Date(Date.now() - i * 86400000), 'yyyy-MM-dd');
      dayMap[d] = { impressions: 0, clicks: 0 };
    }
    const slotMap: Record<string, { impressions: number; clicks: number }> = {};
    const pageMap: Record<string, { impressions: number; clicks: number }> = {};

    fullMetrics.forEach(m => {
      if (!dayMap[m.event_date]) dayMap[m.event_date] = { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') dayMap[m.event_date].impressions += m.count;
      else if (m.event_type === 'click') dayMap[m.event_date].clicks += m.count;

      const sk = m.slot_slug || 'outros';
      if (!slotMap[sk]) slotMap[sk] = { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') slotMap[sk].impressions += m.count;
      else if (m.event_type === 'click') slotMap[sk].clicks += m.count;

      const pk = (m.page_path || '/') === '/' ? 'Home' : (m.page_path || '').replace(/^\//, '').replace(/-/g, ' ').slice(0, 30);
      if (!pageMap[pk]) pageMap[pk] = { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') pageMap[pk].impressions += m.count;
      else if (m.event_type === 'click') pageMap[pk].clicks += m.count;
    });

    const dailyData = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
      date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
      ...v,
    }));
    const slotRanking = Object.entries(slotMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.impressions - a.impressions).slice(0, 8);
    const pageRanking = Object.entries(pageMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.impressions - a.impressions).slice(0, 8);
    const periodImpressions = dailyData.reduce((s, d) => s + d.impressions, 0);
    const periodClicks = dailyData.reduce((s, d) => s + d.clicks, 0);

    exportSponsorPdf({
      sponsorName: (sponsor as any)?.company_name || (sponsor as any)?.contact_name || sponsor?.title || 'Patrocinador',
      plan: (sponsor as any)?.plan || sponsor?.tier || 'standard',
      totalImpressions: sponsor?.impressions || 0,
      totalClicks: sponsor?.clicks || 0,
      ctr: (sponsor?.impressions || 0) > 0 ? (((sponsor?.clicks || 0) / (sponsor?.impressions || 1)) * 100).toFixed(2) : '0.00',
      periodImpressions,
      periodClicks,
      slotRanking,
      pageRanking,
      dailyData,
    });
  }, [fullMetrics, sponsor]);

  const weeklyImpressions = useMemo(() => recentMetrics.filter(m => m.event_type === 'impression').reduce((s, m) => s + m.count, 0), [recentMetrics]);
  const weeklyClicks = useMemo(() => recentMetrics.filter(m => m.event_type === 'click').reduce((s, m) => s + m.count, 0), [recentMetrics]);

  if (loading) {
    return (
      <SponsorLayout>
        <div className="space-y-4">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
          </div>
        </div>
      </SponsorLayout>
    );
  }

  const impressions = sponsor?.impressions || 0;
  const clicks = sponsor?.clicks || 0;
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

  // Guaranteed impressions progress
  const guaranteed = (sponsor as any)?.guaranteed_impressions || 0;
  const delivered = (sponsor as any)?.delivered_impressions || 0;
  const deliveryPct = guaranteed > 0 ? Math.min((delivered / guaranteed) * 100, 100) : 0;

  // Days remaining
  const daysRemaining = sponsor?.end_date
    ? differenceInDays(parseISO(sponsor.end_date), new Date())
    : null;

  // Active campaigns count
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length;
  const activeContracts = contracts.filter((c: any) => c.status === 'active').length;

  // Alerts
  const alerts: { text: string; type: 'warn' | 'info' }[] = [];
  if (!sponsor?.image_url) alerts.push({ text: 'Você ainda não enviou um banner. Envie agora!', type: 'warn' });
  if (daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0) alerts.push({ text: `Seu patrocínio expira em ${daysRemaining} dia(s)!`, type: 'warn' });
  if (daysRemaining !== null && daysRemaining <= 0) alerts.push({ text: 'Seu patrocínio expirou. Entre em contato para renovar.', type: 'warn' });
  if (activeCampaigns === 0 && campaigns.length === 0) alerts.push({ text: 'Crie sua primeira campanha para organizar seus anúncios.', type: 'info' });

  return (
    <SponsorLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Olá, {sponsorContact?.contact_name || sponsor?.title} 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Painel do patrocinador — {sponsor?.title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" className="gap-2" onClick={handleExportPdf}>
                <FileDown className="h-4 w-4" />
                Gerar Relatório Mensal (PDF)
              </Button>
              <Badge variant="outline" className="capitalize gap-1">
                <Crown className="w-3 h-3" /> {sponsor?.tier || 'free'}
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                  a.type === 'warn' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-primary/30 bg-primary/5 text-primary'
                }`}>
                  {a.type === 'warn' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Zap className="w-4 h-4 shrink-0" />}
                  {a.text}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Impressões', value: impressions.toLocaleString('pt-BR'), icon: Eye, sub: `${weeklyImpressions} esta semana` },
            { title: 'Cliques', value: clicks.toLocaleString('pt-BR'), icon: MousePointerClick, sub: `${weeklyClicks} esta semana` },
            { title: 'CTR', value: `${ctr}%`, icon: BarChart3 },
            { title: 'Notificações', value: String(notifications.length), icon: Bell, sub: notifications.length > 0 ? 'não lidas' : undefined, alert: notifications.length > 0 },
          ].map((kpi, i) => (
            <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  {kpi.sub && (
                    <p className={`text-xs mt-1 ${kpi.alert ? 'text-destructive' : 'text-muted-foreground'}`}>{kpi.sub}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Guaranteed impressions progress */}
        {guaranteed > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Impressões Garantidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{delivered.toLocaleString('pt-BR')} de {guaranteed.toLocaleString('pt-BR')}</span>
                  <span className="font-medium">{deliveryPct.toFixed(1)}%</span>
                </div>
                <Progress value={deliveryPct} className="h-2" />
                {deliveryPct >= 100 && (
                  <p className="text-xs text-accent flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Meta de impressões atingida!
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick actions + Status row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Status */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="h-4 w-4" /> Status do Banner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ativo</span>
                  <Badge variant={sponsor?.active ? 'default' : 'secondary'}>
                    {sponsor?.active ? 'Sim' : 'Não'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Posição</span>
                  <Badge variant="outline">{sponsor?.position || '—'}</Badge>
                </div>
                {daysRemaining !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Dias restantes</span>
                    <Badge variant={daysRemaining <= 7 ? 'destructive' : 'outline'}>
                      <Calendar className="w-3 h-3 mr-1" /> {daysRemaining > 0 ? daysRemaining : 'Expirado'}
                    </Badge>
                  </div>
                )}
                {sponsor?.start_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Período</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(sponsor.start_date), 'dd/MM/yy', { locale: ptBR })} —{' '}
                      {sponsor.end_date ? format(parseISO(sponsor.end_date), 'dd/MM/yy', { locale: ptBR }) : '∞'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Ações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link to="/sponsor-panel/banners">
                    <Upload className="w-4 h-4 mr-2" /> {sponsor?.image_url ? 'Alterar Banner' : 'Enviar Banner'}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link to="/sponsor-panel/campanhas">
                    <Megaphone className="w-4 h-4 mr-2" /> {activeCampaigns > 0 ? `${activeCampaigns} campanha(s) ativa(s)` : 'Criar Campanha'}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link to="/sponsor-panel/metricas">
                    <BarChart3 className="w-4 h-4 mr-2" /> Ver Métricas Detalhadas
                  </Link>
                </Button>
                {notifications.length > 0 && (
                  <Button variant="outline" size="sm" className="w-full justify-start text-destructive" asChild>
                    <Link to="/sponsor-panel/notificacoes">
                      <Bell className="w-4 h-4 mr-2" /> {notifications.length} notificação(ões) nova(s)
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Campaigns + Contracts summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Resumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Campanhas</p>
                  {campaigns.length > 0 ? (
                    <div className="space-y-1">
                      {campaigns.slice(0, 3).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-sm">
                          <span className="truncate mr-2">{c.name}</span>
                          <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {c.status}
                          </Badge>
                        </div>
                      ))}
                      {campaigns.length > 3 && (
                        <Link to="/sponsor-panel/campanhas" className="text-xs text-primary hover:underline flex items-center gap-1">
                          Ver todas <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma campanha</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contratos</p>
                  {contracts.length > 0 ? (
                    <div className="space-y-1">
                      {contracts.slice(0, 2).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-sm">
                          <span className="truncate mr-2">{c.contract_number || 'Sem número'}</span>
                          <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {c.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum contrato</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Banner preview */}
        {sponsor?.image_url && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Preview do Banner</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/sponsor-panel/banners" className="text-xs">
                      Editar <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center bg-muted/30 rounded-xl p-3">
                  <SponsorImage src={sponsor.image_url} alt={sponsor.title} className="rounded-xl" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorDashboardPage;
