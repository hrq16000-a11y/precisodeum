/**
 * AdminIntegrityReportsPage — Histórico das rotinas diárias de integridade.
 *
 * Filtros: severidade (daily / critical_alert / all), intervalo de datas,
 * busca textual em details. Modal de detalhe mostra contadores + notificações
 * geradas para o achado crítico (link='/admin/integridade').
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCcw, ShieldAlert, Database,
  Filter, Bell, Eye,
} from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { useSeoHead } from '@/hooks/useSeoHead';
import { toast } from 'sonner';
import PaginationControls from '@/components/PaginationControls';
import { ADMIN_PAGE_SIZE } from '@/lib/constants';

interface Row {
  id: string;
  ran_at: string;
  scope: string;
  finding_count: number;
  details: Record<string, any> | null;
}

interface NotifRow {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

const labels: Record<string, string> = {
  providers_without_services: 'Profissionais sem serviços',
  services_without_category: 'Serviços sem categoria',
  providers_null_city: 'Profissionais sem cidade',
  providers_null_neighborhood: 'Profissionais sem bairro',
  services_null_name: 'Serviços sem nome',
  critical_count: 'Total de críticos',
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const AdminIntegrityReportsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  useSeoHead({
    title: 'Integridade de dados — Admin',
    description: 'Histórico das verificações automáticas de integridade do banco.',
    noindex: true,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Filtros
  const [severity, setSeverity] = useState<'all' | 'daily' | 'critical_alert'>('all');
  const [dateFrom, setDateFrom] = useState(daysAgoIso(30));
  const [dateTo, setDateTo] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modal de detalhe
  const [selected, setSelected] = useState<Row | null>(null);
  const [selectedNotifs, setSelectedNotifs] = useState<NotifRow[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('integrity_reports' as any)
      .select('id, ran_at, scope, finding_count, details')
      .order('ran_at', { ascending: false })
      .limit(200);

    if (severity !== 'all') q = q.eq('scope', severity);
    if (dateFrom) q = q.gte('ran_at', `${dateFrom}T00:00:00Z`);
    if (dateTo) q = q.lte('ran_at', `${dateTo}T23:59:59Z`);

    const { data, error } = await q;
    if (error) {
      toast.error('Falha ao carregar relatórios');
      setRows([]);
    } else {
      setRows((data || []) as unknown as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, dateFrom, dateTo]);

  // Reset paginação quando os filtros mudam
  useEffect(() => { setPage(1); }, [severity, dateFrom, dateTo, search]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const blob = JSON.stringify(r.details || {}).toLowerCase();
      return r.scope.toLowerCase().includes(q) || blob.includes(q);
    });
  }, [rows, search]);

  const runNow = async () => {
    setRunning(true);
    const { error } = await (supabase as any).rpc('run_integrity_check');
    setRunning(false);
    if (error) {
      toast.error('Erro ao rodar verificação: ' + error.message);
      return;
    }
    toast.success('Verificação executada');
    void load();
  };

  const openDetail = async (row: Row) => {
    setSelected(row);
    if (row.scope !== 'critical_alert') {
      setSelectedNotifs([]);
      return;
    }
    setLoadingNotifs(true);
    // Notificações geradas pela mesma rodada (janela de 90s ao redor de ran_at)
    const t = new Date(row.ran_at).getTime();
    const from = new Date(t - 90_000).toISOString();
    const to = new Date(t + 90_000).toISOString();
    const { data, error } = await (supabase
      .from('notifications') as any)
      .select('id, user_id, title, message, read, created_at')
      .eq('link', '/admin/integridade')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .limit(100);
    setLoadingNotifs(false);
    if (error) {
      toast.error('Falha ao carregar notificações');
      setSelectedNotifs([]);
    } else {
      setSelectedNotifs((data || []) as NotifRow[]);
    }
  };

  const last = rows[0];

  if (adminLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Verificando permissões...
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <div>
            <h1 className="text-xl font-bold">Integridade de dados</h1>
            <p className="text-xs text-muted-foreground">
              Verificação diária 03:00 · janela anti-duplicidade configurável
            </p>
          </div>
        </div>
        <Button onClick={runNow} disabled={running} size="sm">
          {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
          Executar agora
        </Button>
      </header>

      {/* Filtros */}
      <Card className="mb-4 p-3">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="sev" className="text-[11px] text-muted-foreground">Severidade</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
              <SelectTrigger id="sev" aria-label="Filtrar por severidade"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical_alert">Críticos</SelectItem>
                <SelectItem value="daily">Rotina diária</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="from" className="text-[11px] text-muted-foreground">De</Label>
            <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Data inicial" />
          </div>
          <div>
            <Label htmlFor="to" className="text-[11px] text-muted-foreground">Até</Label>
            <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Data final" />
          </div>
          <div>
            <Label htmlFor="q" className="text-[11px] text-muted-foreground">Busca (provider/serviço/campo)</Label>
            <Input id="q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: services_without_category" aria-label="Buscar texto nos detalhes" />
          </div>
        </div>
      </Card>

      {last && (
        <Card className={`mb-4 p-4 ${last.finding_count > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            {last.finding_count > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            <span className="font-semibold text-sm">Última verificação — {fmt(last.ran_at)}</span>
            <Badge variant={last.finding_count > 0 ? 'destructive' : 'secondary'} className="ml-auto">
              {last.finding_count} achados
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
            {Object.entries(last.details || {})
              .filter(([k]) => labels[k])
              .map(([k, v]) => (
                <div key={k} className="rounded-md bg-background/60 p-2 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">{labels[k] || k}</span>
                  <span className={`font-bold ${Number(v) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{String(v)}</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5" /> Histórico ({filtered.length})
      </h2>

      {loading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum relatório no filtro selecionado.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE).map((r) => {
            const isCritical = r.scope === 'critical_alert';
            return (
              <Card key={r.id} className={`p-3 ${isCritical ? 'border-destructive/40 bg-destructive/5' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={isCritical ? 'destructive' : 'outline'}
                    className="text-[10px]"
                  >
                    {isCritical ? 'CRÍTICO' : r.scope}
                  </Badge>
                  <span className="text-xs">{fmt(r.ran_at)}</span>
                  <Badge variant={r.finding_count > 0 ? 'destructive' : 'secondary'} className="ml-auto">
                    {r.finding_count} achados
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDetail(r)}
                    aria-label={`Ver detalhe do relatório de ${fmt(r.ran_at)}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {r.details && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                    {Object.entries(r.details)
                      .filter(([k]) => labels[k])
                      .map(([k, v]) => (
                        <span key={k} className="text-muted-foreground">
                          {labels[k] || k}:{' '}
                          <strong className={Number(v) > 0 ? 'text-amber-700' : 'text-foreground'}>{String(v)}</strong>
                        </span>
                      ))}
                  </div>
                )}
                {r.details?.deduplicated && (
                  <div className="mt-1 text-[10px] text-muted-foreground italic">
                    Notificações suprimidas (janela anti-duplicidade de {r.details.window_minutes} min).
                  </div>
                )}
              </Card>
            );
          })}
          <PaginationControls
            currentPage={page}
            totalItems={filtered.length}
            itemsPerPage={ADMIN_PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modal detalhe */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.scope === 'critical_alert' ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              {selected?.scope === 'critical_alert' ? 'Achado crítico' : 'Relatório diário'}
            </DialogTitle>
            <DialogDescription>{selected ? fmt(selected.ran_at) : ''}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(selected.details || {})
                  .filter(([k]) => labels[k])
                  .map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border p-2 text-xs">
                      <div className="text-muted-foreground">{labels[k] || k}</div>
                      <div className={`font-bold text-base ${Number(v) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {String(v)}
                      </div>
                    </div>
                  ))}
              </div>

              {selected.scope === 'critical_alert' && (
                <div>
                  <h3 className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                    <Bell className="h-3.5 w-3.5" /> Notificações geradas
                  </h3>
                  {loadingNotifs ? (
                    <div className="text-xs text-muted-foreground">
                      <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Carregando...
                    </div>
                  ) : selectedNotifs.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">
                      Nenhuma notificação encontrada (pode ter sido suprimida pela janela de dedup).
                    </div>
                  ) : (
                    <ul className="space-y-1.5 max-h-48 overflow-auto">
                      {selectedNotifs.map((n) => (
                        <li key={n.id} className="rounded-md border border-border p-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={n.read ? 'secondary' : 'destructive'} className="text-[9px]">
                              {n.read ? 'Lida' : 'Não lida'}
                            </Badge>
                            <span className="font-medium">{n.title}</span>
                          </div>
                          {n.message && <p className="text-muted-foreground mt-0.5">{n.message}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <details className="rounded-md border border-border bg-muted/30 p-2 text-[11px]">
                <summary className="cursor-pointer text-muted-foreground">Detalhes técnicos (JSON)</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIntegrityReportsPage;
