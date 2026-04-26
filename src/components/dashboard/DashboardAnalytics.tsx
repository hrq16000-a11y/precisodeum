import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Eye, MessageCircle, Phone, TrendingUp, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import ProfileHealthScore from '@/components/dashboard/ProfileHealthScore';
import ProfileHealthChecklist from '@/components/dashboard/ProfileHealthChecklist';

interface SeriesDay {
  label: string;
  date: string;
  views: number;
  whatsapp_clicks: number;
  phone_clicks: number;
}

interface RecentClick {
  id: string;
  contact_type: string;
  created_at: string;
}

const PERIODS = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
] as const;

type Period = (typeof PERIODS)[number]['value'];

const tone = {
  reach: { ring: 'from-primary/15 to-primary/5', icon: 'text-primary', dot: 'bg-primary' },
  interest: { ring: 'from-amber-500/15 to-amber-500/5', icon: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  conversion: { ring: 'from-emerald-500/15 to-emerald-500/5', icon: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
};

const DashboardAnalytics = () => {
  const { provider, loading: authLoading } = useAuth();
  const [series, setSeries] = useState<SeriesDay[]>([]);
  const [leadsCount, setLeadsCount] = useState(0);
  const [recent, setRecent] = useState<RecentClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(30);

  const loadData = async (providerId: string) => {
    const [statsRes, leadsRes, clicksRes] = await Promise.all([
      (supabase.rpc as any)('get_lead_stats', { provider_id: providerId }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('provider_id', providerId),
      supabase
        .from('contact_clicks')
        .select('id, contact_type, created_at')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const rows = ((statsRes.data as any)?.series || []).map((row: any) => ({
      label: String(row.label || ''),
      date: String(row.date || ''),
      views: Number(row.views) || 0,
      whatsapp_clicks: Number(row.whatsapp_clicks) || 0,
      phone_clicks: Number(row.phone_clicks) || 0,
    })) as SeriesDay[];

    setSeries(rows);
    setLeadsCount(leadsRes.count || 0);
    setRecent((clicksRes.data || []) as RecentClick[]);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!provider?.id) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      await loadData(provider.id);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authLoading, provider?.id]);

  // Realtime: novos leads e cliques atualizam contadores sem refresh
  useEffect(() => {
    if (!provider?.id) return;
    const channel = supabase
      .channel(`dashboard-analytics-${provider.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: `provider_id=eq.${provider.id}` },
        () => setLeadsCount((c) => c + 1),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contact_clicks', filter: `provider_id=eq.${provider.id}` },
        (payload) => {
          const row = payload.new as RecentClick;
          setRecent((prev) => [row, ...prev].slice(0, 5));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [provider?.id]);

  const windowed = useMemo(() => series.slice(-period), [series, period]);

  const totals = useMemo(
    () =>
      windowed.reduce(
        (acc, d) => ({
          reach: acc.reach + d.views,
          whatsapp: acc.whatsapp + d.whatsapp_clicks,
          phone: acc.phone + d.phone_clicks,
        }),
        { reach: 0, whatsapp: 0, phone: 0 },
      ),
    [windowed],
  );
  const interestTotal = totals.whatsapp + totals.phone;
  const wppPct = interestTotal > 0 ? Math.round((totals.whatsapp / interestTotal) * 100) : 0;
  const phonePct = interestTotal > 0 ? 100 - wppPct : 0;

  const trendData = useMemo(
    () => windowed.map((d) => ({ label: d.label, whatsapp: d.whatsapp_clicks, phone: d.phone_clicks })),
    [windowed],
  );
  const hasTrendData = trendData.some((d) => d.whatsapp + d.phone > 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!provider?.id) return null;

  return (
    <section className="space-y-4">
      {/* Header + Period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-1.5">
              Saúde e Performance
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            </h2>
            <p className="text-xs text-muted-foreground">
              Últimos {period} dias · atualizado em tempo real
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Selecionar período"
          className="inline-flex self-start rounded-xl border border-border bg-card p-1 sm:self-auto"
        >
          {PERIODS.map((p) => {
            const active = period === p.value;
            return (
              <button
                key={p.value}
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1) Cards de métricas */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Eye}
          label="Alcance"
          hint="Visualizações de perfil e serviços"
          value={totals.reach}
          tone={tone.reach}
        />
        <MetricCard
          icon={MessageCircle}
          label="Interesses"
          hint={`${interestTotal} cliques de contato`}
          value={interestTotal}
          tone={tone.interest}
          breakdown={
            interestTotal > 0
              ? [
                  { label: 'WhatsApp', value: totals.whatsapp, pct: wppPct, color: 'bg-primary' },
                  { label: 'Telefone', value: totals.phone, pct: phonePct, color: 'bg-amber-500' },
                ]
              : undefined
          }
        />
        <MetricCard
          icon={Activity}
          label="Conversão"
          hint="Leads recebidos no total"
          value={leadsCount}
          tone={tone.conversion}
        />
      </div>

      {/* 2) Score de Saúde do Perfil + Checklist navegável */}
      <ProfileHealthScore />
      <ProfileHealthChecklist />

      {/* 3) Tendência de cliques (WhatsApp vs Telefone) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">Cliques de contato</h3>
            <p className="text-[11px] text-muted-foreground">
              WhatsApp vs telefone nos últimos {period} dias
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-primary" /> WhatsApp{' '}
              <strong className="text-foreground tabular-nums">{wppPct}%</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-amber-500" /> Telefone{' '}
              <strong className="text-foreground tabular-nums">{phonePct}%</strong>
            </span>
          </div>
        </div>

        {hasTrendData ? (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="wppGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    color: 'hsl(var(--foreground))',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="whatsapp"
                  name="WhatsApp"
                  stackId="1"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#wppGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="phone"
                  name="Telefone"
                  stackId="1"
                  stroke="hsl(38 92% 50%)"
                  strokeWidth={2}
                  fill="url(#phoneGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-center">
            <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-semibold text-foreground">Sem cliques ainda</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Seu gráfico aparecerá aqui assim que receber os primeiros cliques.
            </p>
          </div>
        )}
      </motion.div>

      {/* 4) Atividade recente */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          <h3 className="font-display text-base font-bold text-foreground">Atividade recente</h3>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Nenhuma interação ainda. Compartilhe sua página pública para começar a receber contatos.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((item) => {
              const Icon = item.contact_type === 'phone' ? Phone : MessageCircle;
              const label =
                item.contact_type === 'phone'
                  ? 'Alguém clicou no seu telefone'
                  : item.contact_type === 'whatsapp'
                    ? 'Alguém clicou no seu WhatsApp'
                    : `Interação registrada (${item.contact_type})`;
              const when = formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR });
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-2.5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{when}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </motion.div>
    </section>
  );
};

interface BreakdownItem {
  label: string;
  value: number;
  pct: number;
  color: string;
}

const MetricCard = ({
  icon: Icon,
  label,
  hint,
  value,
  tone,
  breakdown,
}: {
  icon: typeof Eye;
  label: string;
  hint: string;
  value: number;
  tone: { ring: string; icon: string; dot: string };
  breakdown?: BreakdownItem[];
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden rounded-2xl border border-border bg-card p-4"
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${tone.ring} opacity-60`} aria-hidden />
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-background ${tone.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <AnimatedCounter
        value={value}
        className="mt-1 block font-display text-3xl font-bold leading-none text-foreground"
      />
      {breakdown && breakdown.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            {breakdown.map((b) => (
              <div
                key={b.label}
                className={b.color}
                style={{ width: `${b.pct}%` }}
                aria-label={`${b.label} ${b.pct}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            {breakdown.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-sm ${b.color}`} />
                {b.label} <strong className="text-foreground tabular-nums">{b.pct}%</strong>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  </motion.div>
);

export default DashboardAnalytics;
