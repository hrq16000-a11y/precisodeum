import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Users, Eye, MessageCircle, Target, X as XIcon, Filter, Download } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCategoriesWithCount } from '@/hooks/useProviders';
import { toast } from 'sonner';

interface MetricRow {
  tier: string;
  category_slug: string;
  category_name: string;
  providers_count: number;
  total_visits: number;
  total_dismisses: number;
  total_leads: number;
  total_whatsapp_clicks: number;
  total_views: number;
  conversion_rate: number;
}

const TIERS = [
  { value: 'all', label: 'Todos os tiers' },
  { value: 'novato', label: 'Novato' },
  { value: 'explorador', label: 'Explorador' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'veterano', label: 'Veterano' },
];

const TIER_COLOR: Record<string, string> = {
  novato: 'bg-sky-500/10 text-sky-600',
  explorador: 'bg-violet-500/10 text-violet-600',
  ativo: 'bg-emerald-500/10 text-emerald-600',
  veterano: 'bg-amber-500/10 text-amber-600',
};

const AdminConversionMetricsPage = () => {
  const [tier, setTier] = useState('all');
  const [category, setCategory] = useState('all');
  const [days, setDays] = useState('30');
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: categories = [] } = useCategoriesWithCount();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('admin_conversion_metrics' as any, {
          _tier: tier === 'all' ? null : tier,
          _category_slug: category === 'all' ? null : category,
          _days: Number(days) || 30,
        });
        if (error) throw error;
        if (!cancelled) setRows((data as MetricRow[]) || []);
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message || 'Falha ao carregar métricas.');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tier, category, days]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        providers: acc.providers + (r.providers_count || 0),
        visits: acc.visits + (r.total_visits || 0),
        dismisses: acc.dismisses + (r.total_dismisses || 0),
        leads: acc.leads + (r.total_leads || 0),
        clicks: acc.clicks + (r.total_whatsapp_clicks || 0),
        views: acc.views + (r.total_views || 0),
      }),
      { providers: 0, visits: 0, dismisses: 0, leads: 0, clicks: 0, views: 0 }
    );
  }, [rows]);

  const overallRate = totals.views > 0 ? (totals.leads / totals.views) * 100 : 0;

  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast.info('Sem dados para exportar com os filtros atuais.');
      return;
    }
    const headers = [
      'tier', 'categoria_slug', 'categoria_nome', 'profissionais',
      'views', 'visitas_dashboard', 'cliques_whatsapp', 'leads',
      'widgets_dispensados', 'taxa_conversao_pct',
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(','),
      ...rows.map((r) => [
        r.tier, r.category_slug, r.category_name, r.providers_count,
        r.total_views, r.total_visits, r.total_whatsapp_clicks, r.total_leads,
        r.total_dismisses, Number(r.conversion_rate).toFixed(2),
      ].map(escape).join(',')),
    ].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const tierLabel = tier === 'all' ? 'todos-tiers' : tier;
    const catLabel = category === 'all' ? 'todas-categorias' : category;
    a.href = url;
    a.download = `conversao_${tierLabel}_${catLabel}_${days}d_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`CSV exportado (${rows.length} linhas).`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Conversão por Tier & Categoria</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe o impacto das missões e do checklist nos profissionais por nível de maturidade.
            </p>
          </div>
          <Button onClick={handleExportCsv} variant="outline" size="sm" className="gap-2" disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-[180px] flex-1">
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px] flex-1">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.filter((c) => c.count > 0).map((c) => (
                      <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard icon={Users} label="Profissionais" value={totals.providers} color="text-sky-600 bg-sky-500/10" />
          <KpiCard icon={Eye} label="Views perfis" value={totals.views} color="text-violet-600 bg-violet-500/10" />
          <KpiCard icon={TrendingUp} label="Visitas dashboard" value={totals.visits} color="text-emerald-600 bg-emerald-500/10" />
          <KpiCard icon={MessageCircle} label="Cliques WhatsApp" value={totals.clicks} color="text-green-600 bg-green-500/10" />
          <KpiCard icon={Target} label="Leads gerados" value={totals.leads} color="text-amber-600 bg-amber-500/10" />
          <KpiCard icon={XIcon} label="Widgets dispensados" value={totals.dismisses} color="text-red-500 bg-red-500/10" />
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Taxa global de conversão (leads / views)</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{overallRate.toFixed(2)}%</p>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Tier</th>
                    <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-4 py-3 text-right font-semibold">Profis.</th>
                    <th className="px-4 py-3 text-right font-semibold">Views</th>
                    <th className="px-4 py-3 text-right font-semibold">Visitas</th>
                    <th className="px-4 py-3 text-right font-semibold">WhatsApp</th>
                    <th className="px-4 py-3 text-right font-semibold">Leads</th>
                    <th className="px-4 py-3 text-right font-semibold">Dispensas</th>
                    <th className="px-4 py-3 text-right font-semibold">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td colSpan={9} className="p-3"><Skeleton className="h-6 w-full" /></td>
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        Nenhum dado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => (
                      <tr key={`${r.tier}-${r.category_slug}-${i}`} className="border-b border-border hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={TIER_COLOR[r.tier] || ''}>{r.tier}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{r.category_name}</td>
                        <td className="px-4 py-3 text-right">{r.providers_count}</td>
                        <td className="px-4 py-3 text-right">{r.total_views}</td>
                        <td className="px-4 py-3 text-right">{r.total_visits}</td>
                        <td className="px-4 py-3 text-right">{r.total_whatsapp_clicks}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{r.total_leads}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{r.total_dismisses}</td>
                        <td className="px-4 py-3 text-right font-bold text-accent">{Number(r.conversion_rate).toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

const KpiCard = ({
  icon: Icon, label, value, color,
}: { icon: typeof Users; label: string; value: number; color: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 font-display text-xl font-bold text-foreground">{value.toLocaleString('pt-BR')}</p>
    </CardContent>
  </Card>
);

export default AdminConversionMetricsPage;
