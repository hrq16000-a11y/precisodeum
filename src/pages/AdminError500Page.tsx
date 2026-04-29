/**
 * AdminError500Page — central de monitoramento de erros 500.
 *
 * Mostra:
 *  - KPIs (total, última hora, últimas 24h, usuários únicos)
 *  - Distribuição por hora do dia (heatmap simples)
 *  - Top caminhos e referenciadores
 *  - Lista de eventos recentes em tempo real (postgres_changes)
 *
 * Fontes: RPCs admin_error_500_summary / admin_error_500_recent (RLS admin).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Bell, BellOff } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playHorn } from '@/lib/soundFx';

interface Summary {
  total: number;
  last_hour: number;
  last_24h: number;
  unique_users: number;
  by_hour: Array<{ hour: number; count: number }>;
  by_day: Array<{ day: string; count: number }>;
  top_paths: Array<{ path: string; count: number }>;
  top_referrers: Array<{ referrer: string; count: number }>;
}

interface RecentEvent {
  id: string;
  occurred_at: string;
  path: string;
  referrer: string | null;
  user_id: string | null;
  user_agent: string | null;
}

const SOUND_KEY = 'admin_error500_sound';

const AdminError500Page = () => {
  const [hours, setHours] = useState('48');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(SOUND_KEY) !== '0';
  });
  const seenIds = useRef<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        (supabase as any).rpc('admin_error_500_summary', { _hours: Number(hours) || 48 }),
        (supabase as any).rpc('admin_error_500_recent', { _limit: 100 }),
      ]);
      if (s.error) throw s.error;
      if (r.error) throw r.error;
      setSummary(s.data as Summary);
      const list = (r.data || []) as RecentEvent[];
      seenIds.current = new Set(list.map((e) => e.id));
      setRecent(list);
    } catch (e: any) {
      toast.error('Falha ao carregar 500s: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [hours]);

  // Realtime: novos hits de 500
  useEffect(() => {
    const channel = supabase
      .channel('admin-error-500')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'error_page_events', filter: 'code=eq.500' },
        (payload: any) => {
          const ev = payload.new as RecentEvent;
          if (seenIds.current.has(ev.id)) return;
          seenIds.current.add(ev.id);
          setRecent((prev) => [ev, ...prev].slice(0, 100));
          toast.error('Novo erro 500 detectado', {
            description: ev.path || '(sem path)',
            duration: 6000,
          });
          if (soundEnabled) {
            try { void playHorn(); } catch { /* fail-soft */ }
          }
          // Atualiza KPIs em background
          void load();
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try { localStorage.setItem(SOUND_KEY, next ? '1' : '0'); } catch { /* noop */ }
    toast.success(next ? 'Alerta sonoro ativado' : 'Alerta sonoro silenciado');
  };

  const maxByHour = useMemo(
    () => Math.max(1, ...(summary?.by_hour || []).map((h) => h.count)),
    [summary],
  );

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Alertas de erro 500
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitoramento em tempo real de hits em <code className="text-xs bg-muted px-1 rounded">/error/500</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSound}
              className="gap-1.5"
              aria-pressed={soundEnabled}
              title={soundEnabled ? 'Silenciar buzina' : 'Ativar buzina'}
            >
              {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              {soundEnabled ? 'Som ativo' : 'Silencioso'}
            </Button>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Última hora</SelectItem>
                <SelectItem value="24">Últimas 24h</SelectItem>
                <SelectItem value="48">Últimas 48h</SelectItem>
                <SelectItem value="168">Últimos 7 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Total no período" value={summary?.total ?? 0} loading={loading} />
          <Kpi label="Última hora" value={summary?.last_hour ?? 0} loading={loading} tone={summary && summary.last_hour > 0 ? 'danger' : undefined} />
          <Kpi label="Últimas 24h" value={summary?.last_24h ?? 0} loading={loading} />
          <Kpi label="Usuários únicos" value={summary?.unique_users ?? 0} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Distribuição por hora */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Por hora do dia (BRT)</h3>
              {loading && !summary ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="grid grid-cols-12 gap-0.5 items-end h-32">
                  {Array.from({ length: 24 }).map((_, h) => {
                    const found = summary?.by_hour.find((x) => x.hour === h);
                    const c = found?.count || 0;
                    const heightPct = (c / maxByHour) * 100;
                    return (
                      <div key={h} className="flex flex-col items-center justify-end gap-1 h-full" title={`${h}h: ${c}`}>
                        <div
                          className={`w-full rounded-t ${c > 0 ? 'bg-destructive/70' : 'bg-muted'}`}
                          style={{ height: `${Math.max(heightPct, c > 0 ? 6 : 2)}%` }}
                        />
                        <span className="text-[9px] text-muted-foreground">{h}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Use os picos para correlacionar com deploys ou tráfego.
              </p>
            </CardContent>
          </Card>

          {/* Top paths */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-bold text-foreground">Top caminhos com 500</h3>
              {loading && !summary ? (
                <Skeleton className="h-32 w-full" />
              ) : (summary?.top_paths || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum 500 no período.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {summary!.top_paths.map((p) => (
                    <li key={p.path} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5">
                      <code className="truncate text-foreground">{p.path || '(vazio)'}</code>
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive font-bold">{p.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top referrers */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Top origens (referrer)</h3>
            {loading && !summary ? (
              <Skeleton className="h-20 w-full" />
            ) : (summary?.top_referrers || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {summary!.top_referrers.map((r) => (
                  <Badge key={r.referrer} variant="outline" className="text-xs">
                    {r.referrer.length > 60 ? r.referrer.slice(0, 57) + '…' : r.referrer}
                    <span className="ml-1.5 font-bold text-destructive">{r.count}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Eventos recentes */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">Eventos recentes (tempo real)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Quando</th>
                    <th className="px-3 py-2 text-left">Caminho</th>
                    <th className="px-3 py-2 text-left">Origem</th>
                    <th className="px-3 py-2 text-left">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recent.length === 0 ? (
                    <tr><td colSpan={4} className="p-4"><Skeleton className="h-6 w-full" /></td></tr>
                  ) : recent.length === 0 ? (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum 500 registrado.</td></tr>
                  ) : recent.map((e) => (
                    <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap text-foreground">{fmtTime(e.occurred_at)}</td>
                      <td className="px-3 py-2 max-w-[280px] truncate"><code className="text-foreground">{e.path}</code></td>
                      <td className="px-3 py-2 max-w-[220px] truncate text-muted-foreground">{e.referrer || '(direto)'}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                        {e.user_id ? e.user_id.slice(0, 8) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

interface KpiProps { label: string; value: number; loading?: boolean; tone?: 'danger' }
const Kpi = ({ label, value, loading, tone }: KpiProps) => (
  <Card className={tone === 'danger' ? 'border-2 border-destructive/40 bg-destructive/5' : ''}>
    <CardContent className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-16 mt-1" />
      ) : (
        <p className={`font-display text-2xl font-bold tabular-nums ${tone === 'danger' ? 'text-destructive' : 'text-foreground'}`}>
          {value.toLocaleString('pt-BR')}
        </p>
      )}
    </CardContent>
  </Card>
);

export default AdminError500Page;
