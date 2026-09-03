import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface LocalFunnelRow {
  day: string;
  action: 'page_view' | 'form_submit' | 'whatsapp_click' | string;
  city: string | null;
  neighborhood: string | null;
  category: string | null;
  events: number;
}

const ACTION_LABEL: Record<string, string> = {
  page_view: 'Visitas',
  form_submit: 'Formulários',
  whatsapp_click: 'WhatsApp',
};

const COLORS: Record<string, string> = {
  page_view: 'hsl(var(--primary))',
  form_submit: 'hsl(var(--bet-orange))',
  whatsapp_click: 'hsl(var(--bet-green))',
};

const dimTable = (rows: LocalFunnelRow[], pick: (r: LocalFunnelRow) => string | null) => {
  const map = new Map<string, { key: string; views: number; forms: number; whats: number }>();
  rows.forEach((r) => {
    const key = (pick(r) || '').trim() || 'Não informado';
    const cur = map.get(key) || { key, views: 0, forms: 0, whats: 0 };
    if (r.action === 'page_view') cur.views += Number(r.events);
    if (r.action === 'form_submit') cur.forms += Number(r.events);
    if (r.action === 'whatsapp_click') cur.whats += Number(r.events);
    map.set(key, cur);
  });
  return Array.from(map.values()).sort((a, b) => (b.views + b.forms + b.whats) - (a.views + a.forms + a.whats));
};

const DimCard = ({ title, rows }: { title: string; rows: ReturnType<typeof dimTable> }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
        {title}
        <Badge variant="secondary" className="ml-auto text-[10px]">{rows.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Sem eventos no período.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 15).map((r) => {
            const conv = r.views ? Math.round(((r.forms + r.whats) / r.views) * 100) : 0;
            return (
              <li key={r.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-foreground">{r.key}</span>
                <span className="flex shrink-0 items-center gap-2 font-mono text-muted-foreground">
                  <span title="Visitas">{r.views}</span>
                  <span title="Formulários">/ {r.forms}</span>
                  <span title="WhatsApp">/ {r.whats}</span>
                  <Badge variant="outline" className={conv >= 10 ? 'border-emerald-500/30 text-emerald-600' : 'text-muted-foreground'}>
                    {conv}%
                  </Badge>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </CardContent>
  </Card>
);

/**
 * Painel de funil hiperlocal alimentado pelos eventos instrumentados
 * (page_view / form_submit / whatsapp_click) via RPC admin_local_funnel_stats.
 */
const LocalFunnelPanel = ({ days }: { days: number }) => {
  const [rows, setRows] = useState<LocalFunnelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_local_funnel_stats' as never, { _days: days } as never);
      if (cancelled) return;
      if (error) {
        toast.error('Falha ao carregar telemetria local: ' + error.message);
        setRows([]);
      } else {
        setRows(((data as unknown as LocalFunnelRow[]) || []));
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [days]);

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; page_view: number; form_submit: number; whatsapp_click: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.day) || { day: r.day, page_view: 0, form_submit: 0, whatsapp_click: 0 };
      if (r.action in cur) (cur as any)[r.action] += Number(r.events);
      map.set(r.day, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  const cities = useMemo(() => dimTable(rows, (r) => r.city), [rows]);
  const hoods = useMemo(() => dimTable(rows, (r) => r.neighborhood), [rows]);
  const categories = useMemo(() => dimTable(rows, (r) => r.category), [rows]);

  const exportCsv = () => {
    const head = ['dia', 'acao', 'cidade', 'bairro', 'categoria', 'eventos'].join(',');
    const body = rows.map((r) => [
      r.day,
      r.action,
      `"${(r.city || '').replace(/"/g, '""')}"`,
      `"${(r.neighborhood || '').replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      r.events,
    ].join(','));
    const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `funil-local-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Funil hiperlocal por dia
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : daily.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Sem eventos registrados no período. A telemetria começa a alimentar este gráfico após a publicação.
            </p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend formatter={(v) => ACTION_LABEL[String(v)] || String(v)} />
                  {(['page_view', 'form_submit', 'whatsapp_click'] as const).map((k) => (
                    <Area key={k} type="monotone" dataKey={k} stroke={COLORS[k]} fill={COLORS[k]} fillOpacity={0.15} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <DimCard title="Cidades (visitas / form / whats)" rows={cities} />
        <DimCard title="Bairros (visitas / form / whats)" rows={hoods} />
        <DimCard title="Categorias (visitas / form / whats)" rows={categories} />
      </div>
    </div>
  );
};

export default LocalFunnelPanel;
