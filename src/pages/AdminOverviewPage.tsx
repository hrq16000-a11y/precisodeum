import { useMemo } from 'react';
import AdminErrorAlerts from '@/components/admin/AdminErrorAlerts';
import AdminCriticalAlerts from '@/components/admin/AdminCriticalAlerts';
import SystemHealthPanel from '@/components/admin/SystemHealthPanel';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, TrendingDown, DollarSign, Target, LayoutGrid, Megaphone, BarChart3, Minus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { differenceInDays, subDays } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

const AdminOverviewPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();

  const { data: profiles = [] } = useQuery({
    queryKey: ['overview-profiles'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('profile_type, status, created_at');
      return (data || []) as any[];
    },
  });

  const { data: profilesPrev = [] } = useQuery({
    queryKey: ['overview-profiles-prev'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
        .gte('created_at', subDays(new Date(), 60).toISOString())
        .lt('created_at', subDays(new Date(), 30).toISOString());
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['overview-subscriptions'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('subscriptions' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: accountTypes = [] } = useQuery({
    queryKey: ['overview-account-types'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('account_types').select('id, name, price');
      return (data || []) as any[];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['overview-leads'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('id, status, created_at').gte('created_at', subDays(new Date(), 30).toISOString());
      return (data || []) as any[];
    },
  });

  const { data: adSlots = [] } = useQuery({
    queryKey: ['overview-slots'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('ad_slots').select('id, name, max_ads');
      return (data || []) as any[];
    },
  });

  const { data: slotAssignments = [] } = useQuery({
    queryKey: ['overview-slot-assignments'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('ad_slot_assignments').select('id, slot_id, active').eq('active', true);
      return (data || []) as any[];
    },
  });

  const { data: sponsors = [] } = useQuery({
    queryKey: ['overview-sponsors'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('sponsors' as any).select('id, title, impressions, clicks, active').eq('active', true).order('clicks', { ascending: false }).limit(5);
      return (data || []) as any[];
    },
  });

  // ── Computed KPIs ──
  const atMap = useMemo(() => {
    const m: Record<string, any> = {};
    accountTypes.forEach((a: any) => { m[a.id] = a; });
    return m;
  }, [accountTypes]);

  const usersByType = useMemo(() => {
    const map: Record<string, number> = {};
    profiles.forEach((p: any) => {
      const t = p.profile_type || 'other';
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name === 'client' ? 'Clientes' : name === 'provider' ? 'Prestadores' : name === 'rh' ? 'RH' : name,
      value,
    }));
  }, [profiles]);

  const mrr = useMemo(() => {
    let total = 0;
    subscriptions.forEach((s: any) => {
      if (s.status === 'active' || s.status === 'trial') {
        const at = s.account_type_id ? atMap[s.account_type_id] : null;
        total += at?.price || 0;
      }
    });
    return total;
  }, [subscriptions, atMap]);

  const churnRate = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const canceled = subscriptions.filter((s: any) => s.status === 'canceled' && new Date(s.created_at) >= thirtyDaysAgo).length;
    const total = subscriptions.length || 1;
    return ((canceled / total) * 100).toFixed(1);
  }, [subscriptions]);

  const leadConversion = useMemo(() => {
    const total = leads.length || 1;
    const converted = leads.filter((l: any) => l.status === 'converted' || l.status === 'contacted').length;
    return { total: leads.length, converted, rate: ((converted / total) * 100).toFixed(1) };
  }, [leads]);

  const slotOccupancy = useMemo(() => {
    const totalCapacity = adSlots.reduce((acc: number, s: any) => acc + (s.max_ads || 1), 0);
    const occupied = slotAssignments.length;
    return { totalCapacity, occupied, rate: totalCapacity > 0 ? ((occupied / totalCapacity) * 100).toFixed(0) : '0' };
  }, [adSlots, slotAssignments]);

  const topSponsors = useMemo(() => {
    return sponsors.map((s: any) => ({
      name: (s.title || '').slice(0, 20),
      impressions: s.impressions || 0,
      clicks: s.clicks || 0,
      ctr: s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0',
    }));
  }, [sponsors]);

  // Trend helpers
  const newThisMonth = profiles.filter((p: any) => new Date(p.created_at) >= subDays(new Date(), 30)).length;
  const churnNum = parseFloat(churnRate);

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  const kpiCards = [
    {
      label: 'MRR',
      value: `R$ ${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      trend: null as string | null,
      trendUp: true,
      sub: null as string | null,
    },
    {
      label: 'Usuários',
      value: profiles.length.toString(),
      icon: Users,
      iconBg: 'bg-blue-50 dark:bg-blue-500/10',
      iconColor: 'text-blue-600',
      trend: newThisMonth > 0 ? `+${newThisMonth} este mês` : null,
      trendUp: true,
      sub: null,
    },
    {
      label: 'Assinaturas',
      value: subscriptions.length.toString(),
      icon: TrendingUp,
      iconBg: 'bg-violet-50 dark:bg-violet-500/10',
      iconColor: 'text-violet-600',
      trend: null,
      trendUp: true,
      sub: null,
    },
    {
      label: 'Churn',
      value: `${churnRate}%`,
      icon: TrendingDown,
      iconBg: 'bg-red-50 dark:bg-red-500/10',
      iconColor: 'text-red-500',
      trend: churnNum > 5 ? 'Alto' : churnNum > 0 ? 'Moderado' : 'Zero',
      trendUp: churnNum === 0,
      sub: null,
    },
    {
      label: 'Leads (30d)',
      value: leadConversion.total.toString(),
      icon: Target,
      iconBg: 'bg-amber-50 dark:bg-amber-500/10',
      iconColor: 'text-amber-600',
      trend: `${leadConversion.rate}% conv.`,
      trendUp: parseFloat(leadConversion.rate) > 10,
      sub: null,
    },
    {
      label: 'Slots',
      value: `${slotOccupancy.occupied}/${slotOccupancy.totalCapacity}`,
      icon: LayoutGrid,
      iconBg: 'bg-cyan-50 dark:bg-cyan-500/10',
      iconColor: 'text-cyan-600',
      trend: `${slotOccupancy.rate}% ocupado`,
      trendUp: parseInt(slotOccupancy.rate) > 50,
      sub: null,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminCriticalAlerts />
        <AdminErrorAlerts />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Visão Executiva
            </h1>
            <p className="text-sm text-muted-foreground">Painel unificado do sistema</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={async () => {
              const tid = toast.loading('Gerando relatório...');
              const { data, error } = await (supabase.rpc as any)('admin_export_audit_logs', { _days: 30 });
              if (error) { toast.error('Falha ao exportar', { id: tid }); return; }
              const rows: any[] = data || [];
              if (rows.length === 0) { toast.warning('Nenhum log nos últimos 30 dias', { id: tid }); return; }
              const esc = (v: any) => {
                if (v === null || v === undefined) return '';
                const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
              };
              const headers = ['data', 'staff_email', 'acao', 'alvo_email', 'old_values', 'new_values'];
              const csv = [
                headers.join(';'),
                ...rows.map((r) => [
                  new Date(r.created_at).toLocaleString('pt-BR'),
                  r.staff_email || '',
                  r.action,
                  r.target_email || '',
                  r.old_values || '',
                  r.new_values || '',
                ].map(esc).join(';')),
              ].join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`${rows.length} registros exportados`, { id: tid });
            }}
          >
            <Download className="h-4 w-4" />
            Exportar Auditoria (CSV)
          </Button>
        </div>

        {/* KPI Cards — Modern Dashboard Style */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                    <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
                  </div>
                  {kpi.trend && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      kpi.trendUp
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                    }`}>
                      {kpi.trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {kpi.trend}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{kpi.value}</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wide">{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* System Health (real operational counters + actions) */}
        <SystemHealthPanel />

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Usuários por Tipo</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={usersByType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {usersByType.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" /> Top Patrocinadores (CTR)
            </h3>
            <div className="h-[220px]">
              {topSponsors.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSponsors} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis type="number" className="text-[10px]" />
                    <YAxis type="category" dataKey="name" width={100} className="text-[10px]" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }} />
                    <Bar dataKey="clicks" fill="hsl(var(--primary))" name="Cliques" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem dados de patrocinadores</div>
              )}
            </div>
          </div>
        </div>

        {/* Sponsor performance table */}
        {topSponsors.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Performance de Patrocinadores</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="pb-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Patrocinador</th>
                    <th className="pb-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Impressões</th>
                    <th className="pb-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cliques</th>
                    <th className="pb-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {topSponsors.map((s, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 font-medium text-foreground">{s.name}</td>
                      <td className="py-3.5 text-right text-muted-foreground tabular-nums">{s.impressions.toLocaleString()}</td>
                      <td className="py-3.5 text-right text-muted-foreground tabular-nums">{s.clicks.toLocaleString()}</td>
                      <td className="py-3.5 text-right">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">{s.ctr}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOverviewPage;
