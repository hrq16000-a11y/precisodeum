import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Tag, Building2, Download, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatLeadLocation, formatLeadNeighborhood } from '@/lib/leadContext';

type LeadRow = {
  id: string;
  status: string;
  created_at: string;
  lead_context: any;
  providers?: { city: string | null; state: string | null; neighborhood: string | null } | null;
};

type Bucket = { key: string; total: number; converted: number };

const FETCH_CAP = 1000;

const aggregate = (rows: LeadRow[], pick: (r: LeadRow) => string | null): Bucket[] => {
  const map = new Map<string, Bucket>();
  rows.forEach((r) => {
    const key = (pick(r) || '').trim() || 'Não informado';
    const cur = map.get(key) || { key, total: 0, converted: 0 };
    cur.total += 1;
    if (r.status === 'converted') cur.converted += 1;
    map.set(key, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

const BucketTable = ({
  title,
  icon: Icon,
  buckets,
  loading,
}: {
  title: string;
  icon: typeof MapPin;
  buckets: Bucket[];
  loading: boolean;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
        <Badge variant="secondary" className="ml-auto text-[10px]">{buckets.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      ) : buckets.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Sem leads no período.</p>
      ) : (
        <ul className="space-y-1.5">
          {buckets.slice(0, 15).map((b) => {
            const rate = b.total ? Math.round((b.converted / b.total) * 100) : 0;
            return (
              <li key={b.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-foreground">{b.key}</span>
                <span className="flex shrink-0 items-center gap-2 font-mono text-muted-foreground">
                  <span>{b.total}</span>
                  <Badge
                    variant="outline"
                    className={rate >= 30 ? 'border-emerald-500/30 text-emerald-600' : 'text-muted-foreground'}
                  >
                    {rate}%
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

const AdminLeadGeoConversionPage = () => {
  const [days, setDays] = useState('30');
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const { data, error } = await supabase
        .from('leads')
        .select('id, status, created_at, lead_context, providers(city, state, neighborhood)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(FETCH_CAP);
      if (cancelled) return;
      if (error) {
        toast.error('Falha ao carregar leads: ' + error.message);
        setRows([]);
      } else {
        setRows((data as unknown as LeadRow[]) || []);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [days]);

  const cityBuckets = useMemo(
    () => aggregate(rows, (r) =>
      formatLeadLocation(r.lead_context) || [r.providers?.city, r.providers?.state].filter(Boolean).join(' - ')),
    [rows],
  );
  const hoodBuckets = useMemo(
    () => aggregate(rows, (r) => formatLeadNeighborhood(r.lead_context) || r.providers?.neighborhood || null),
    [rows],
  );
  const categoryBuckets = useMemo(
    () => aggregate(rows, (r) => (r.lead_context as any)?.category ?? null),
    [rows],
  );

  const totals = useMemo(() => {
    const total = rows.length;
    const converted = rows.filter((r) => r.status === 'converted').length;
    return { total, converted, rate: total ? Math.round((converted / total) * 100) : 0 };
  }, [rows]);

  const exportCsv = () => {
    const lines = [['dimensao', 'valor', 'leads', 'convertidos'].join(',')];
    const push = (dim: string, list: Bucket[]) =>
      list.forEach((b) => lines.push([dim, `"${b.key.replace(/"/g, '""')}"`, b.total, b.converted].join(',')));
    push('cidade', cityBuckets);
    push('bairro', hoodBuckets);
    push('categoria', categoryBuckets);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversao-leads-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Conversão por Cidade, Bairro e Categoria</h1>
            <p className="text-sm text-muted-foreground">
              Leads reais dos últimos {days} dias, segmentados pela telemetria de contexto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || rows.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Leads no período</p>
            <p className="text-2xl font-bold">{loading ? '—' : totals.total}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Convertidos</p>
            <p className="text-2xl font-bold text-emerald-600">{loading ? '—' : totals.converted}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" /> Taxa de conversão</p>
            <p className="text-2xl font-bold">{loading ? '—' : `${totals.rate}%`}</p>
          </CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <BucketTable title="Cidades" icon={MapPin} buckets={cityBuckets} loading={loading} />
          <BucketTable title="Bairros" icon={Building2} buckets={hoodBuckets} loading={loading} />
          <BucketTable title="Categorias" icon={Tag} buckets={categoryBuckets} loading={loading} />
        </div>

        <LocalFunnelPanel days={Number(days)} />
      </div>
    </AdminLayout>
  );
};

export default AdminLeadGeoConversionPage;
