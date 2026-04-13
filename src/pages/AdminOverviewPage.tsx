import { useMemo } from 'react';
import AdminErrorAlerts from '@/components/admin/AdminErrorAlerts';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, DollarSign, Target, LayoutGrid, Megaphone, ArrowDownRight, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminErrorAlerts />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Visão Executiva
          </h1>
          <p className="text-sm text-muted-foreground">Painel unificado do sistema — dados em tempo real</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-primary uppercase">MRR</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Usuários</span>
              </div>
              <p className="text-xl font-bold text-foreground">{profiles.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Assinaturas</span>
              </div>
              <p className="text-xl font-bold text-foreground">{subscriptions.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Churn</span>
              </div>
              <p className="text-xl font-bold text-foreground">{churnRate}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Leads 30d</span>
              </div>
              <p className="text-xl font-bold text-foreground">{leadConversion.total}</p>
              <p className="text-[10px] text-muted-foreground">{leadConversion.rate}% conv.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Slots</span>
              </div>
              <p className="text-xl font-bold text-foreground">{slotOccupancy.occupied}/{slotOccupancy.totalCapacity}</p>
              <p className="text-[10px] text-muted-foreground">{slotOccupancy.rate}% ocupado</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Users by Type - Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Usuários por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={usersByType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {usersByType.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Sponsors - Bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4" /> Top Patrocinadores (CTR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                {topSponsors.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSponsors} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-[10px]" />
                      <YAxis type="category" dataKey="name" width={100} className="text-[10px]" />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="hsl(var(--primary))" name="Cliques" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem dados de patrocinadores</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sponsor performance table */}
        {topSponsors.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Performance de Patrocinadores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2">Patrocinador</th>
                      <th className="pb-2 text-right">Impressões</th>
                      <th className="pb-2 text-right">Cliques</th>
                      <th className="pb-2 text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSponsors.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 font-medium">{s.name}</td>
                        <td className="py-2 text-right text-muted-foreground">{s.impressions.toLocaleString()}</td>
                        <td className="py-2 text-right text-muted-foreground">{s.clicks.toLocaleString()}</td>
                        <td className="py-2 text-right">
                          <Badge variant="outline" className="text-[10px]">{s.ctr}%</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOverviewPage;
