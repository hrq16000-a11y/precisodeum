import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Trophy, AlertTriangle, EyeOff, Sparkles } from 'lucide-react';

type Row = {
  provider_id: string;
  business_name: string;
  city: string;
  category_slug: string;
  profile_views: number;
  contacts: number;
  lead_submits: number;
  ctr: number;
  lead_rate: number;
  bucket: 'high_conversion' | 'medium_conversion' | 'low_conversion' | 'unknown';
};

const BUCKET_STYLES: Record<Row['bucket'], { label: string; cls: string }> = {
  high_conversion: { label: 'Alta', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  medium_conversion: { label: 'Média', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  low_conversion: { label: 'Baixa', cls: 'bg-rose-500/15 text-rose-700 border-rose-500/30' },
  unknown: { label: 'Sem amostra', cls: 'bg-muted text-muted-foreground border-border' },
};

function pct(v: number) {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

export default function AdminProviderConversionPage() {
  const [days, setDays] = useState(30);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-provider-conversion', days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_provider_conversion_insights' as any, {
        _days: days,
        _limit: 200,
      } as any);
      if (error) throw error;
      return (data as Row[]) || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const top = useMemo(() => rows.filter(r => r.bucket === 'high_conversion').slice(0, 20), [rows]);
  const bottom = useMemo(() => rows.filter(r => r.bucket === 'low_conversion').slice(0, 20), [rows]);
  const noClicks = useMemo(() => rows.filter(r => r.profile_views >= 10 && r.contacts === 0).slice(0, 20), [rows]);

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Conversão por Profissional
            </h1>
            <p className="text-sm text-muted-foreground">
              Insights de CTR, contatos e leads a partir do funil público canônico.
            </p>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0,1,2].map(i => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <InsightCard icon={<Trophy className="h-4 w-4 text-emerald-600" />} title="Top conversão" rows={top} emptyText="Sem profissionais com alta conversão na janela." />
            <InsightCard icon={<AlertTriangle className="h-4 w-4 text-rose-600" />} title="Baixa conversão" rows={bottom} emptyText="Nenhum perfil classificado como baixa conversão." />
            <InsightCard icon={<EyeOff className="h-4 w-4 text-amber-600" />} title="Vistos sem clique" rows={noClicks} emptyText="Todos os perfis com ≥10 views receberam algum clique." />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking completo ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Profissional</th>
                  <th className="px-3 py-2">Cidade</th>
                  <th className="px-3 py-2 text-right">Views</th>
                  <th className="px-3 py-2 text-right">Contatos</th>
                  <th className="px-3 py-2 text-right">Leads</th>
                  <th className="px-3 py-2 text-right">CTR</th>
                  <th className="px-3 py-2 text-right">Lead rate</th>
                  <th className="px-3 py-2">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = BUCKET_STYLES[r.bucket];
                  return (
                    <tr key={r.provider_id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Link to={`/admin/prestadores?id=${r.provider_id}`} className="text-primary hover:underline">
                          {r.business_name || r.provider_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.city || '—'}</td>
                      <td className="px-3 py-2 text-right">{r.profile_views}</td>
                      <td className="px-3 py-2 text-right">{r.contacts}</td>
                      <td className="px-3 py-2 text-right font-medium">{r.lead_submits}</td>
                      <td className="px-3 py-2 text-right">{pct(r.ctr)}</td>
                      <td className="px-3 py-2 text-right">{pct(r.lead_rate)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={b.cls}>{b.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Sem dados na janela selecionada.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function InsightCard({ icon, title, rows, emptyText }: { icon: React.ReactNode; title: string; rows: Row[]; emptyText: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((r) => (
            <Link key={r.provider_id} to={`/admin/prestadores?id=${r.provider_id}`} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs hover:bg-muted/40">
              <span className="truncate font-medium">{r.business_name || r.provider_id.slice(0, 8)}</span>
              <span className="text-muted-foreground tabular-nums">
                {r.profile_views}v · {r.contacts}c · {r.lead_submits}l
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
