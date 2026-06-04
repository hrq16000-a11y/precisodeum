/**
 * AdminErrorReportsPage — central de monitoramento de erros capturados
 * pelo globalErrorMonitor + ErrorGuard (table `error_reports`).
 *
 * Por que aqui e não Sentry: com o volume atual de tráfego, o painel interno
 * resolve o problema sem custo recorrente. O `globalErrorMonitor` já detecta
 * `window.Sentry` quando presente — o dia em que justificar o SDK externo,
 * basta plugar o DSN e os dois sinks rodam juntos.
 *
 * Recursos:
 *  - KPIs (1h, 24h, 7d, usuários únicos)
 *  - Alerta destacado quando erros/hora > threshold (default 20, editável via
 *    site_settings.error_reports_alert_threshold_per_hour)
 *  - Filtros: severity, resolvido, busca em message/component/path
 *  - Paginação ADMIN_PAGE_SIZE
 *  - Resolver / ver detalhes (stack, action_history, viewport, UA)
 *  - Realtime via postgres_changes (novos erros aparecem sem refresh)
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, RefreshCw, Search, Bell, BellOff } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ADMIN_PAGE_SIZE } from '@/lib/constants';
import { useDebounce } from '@/hooks/useDebounce';
import { logAuditAction } from '@/hooks/useAuditLog';

interface ErrorReport {
  id: string;
  page_path: string;
  action_context: string;
  error_message: string;
  error_stack: string | null;
  component_name: string | null;
  user_agent: string | null;
  viewport: string | null;
  action_history: any;
  severity: string;
  resolved: boolean;
  created_at: string;
  user_id: string | null;
  app_version: string | null;
  build_id: string | null;
}

const DEFAULT_THRESHOLD = 20;

const AdminErrorReportsPage = () => {
  const [rows, setRows] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resolvedFilter, setResolvedFilter] = useState<string>('open');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [detail, setDetail] = useState<ErrorReport | null>(null);
  const [kpis, setKpis] = useState({ last_hour: 0, last_24h: 0, last_7d: 0, users: 0 });
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [soundOn, setSoundOn] = useState(false);

  const fetchKpis = async () => {
    const now = Date.now();
    const h1 = new Date(now - 3_600_000).toISOString();
    const h24 = new Date(now - 86_400_000).toISOString();
    const d7 = new Date(now - 7 * 86_400_000).toISOString();
    const [{ count: c1 }, { count: c24 }, { count: c7 }, usersRes] = await Promise.all([
      (supabase as any).from('error_reports').select('id', { count: 'exact', head: true }).gte('created_at', h1),
      (supabase as any).from('error_reports').select('id', { count: 'exact', head: true }).gte('created_at', h24),
      (supabase as any).from('error_reports').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      (supabase as any).from('error_reports').select('user_id').gte('created_at', h24).not('user_id', 'is', null),
    ]);
    const uniq = new Set((usersRes.data || []).map((r: any) => r.user_id));
    setKpis({ last_hour: c1 ?? 0, last_24h: c24 ?? 0, last_7d: c7 ?? 0, users: uniq.size });
  };

  const fetchThreshold = async () => {
    const { data } = await (supabase as any)
      .from('site_settings').select('value')
      .eq('key', 'error_reports_alert_threshold_per_hour').maybeSingle();
    const raw = data?.value;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) setThreshold(n);
  };

  const fetchRows = async () => {
    setLoading(true);
    let q = (supabase as any).from('error_reports').select('*', { count: 'exact' });
    if (severityFilter !== 'all') q = q.eq('severity', severityFilter);
    if (resolvedFilter === 'open') q = q.eq('resolved', false);
    if (resolvedFilter === 'resolved') q = q.eq('resolved', true);
    if (debouncedSearch) {
      const s = `%${debouncedSearch}%`;
      q = q.or(`error_message.ilike.${s},component_name.ilike.${s},page_path.ilike.${s}`);
    }
    const from = page * ADMIN_PAGE_SIZE;
    const to = from + ADMIN_PAGE_SIZE - 1;
    const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to);
    if (error) {
      toast.error('Falha ao carregar erros: ' + error.message);
    } else {
      setRows((data as any[]) || []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => { void fetchKpis(); void fetchThreshold(); }, []);
  useEffect(() => { void fetchRows(); }, [page, severityFilter, resolvedFilter, debouncedSearch]);

  // Realtime: novos erros refrescam tudo (com som opcional)
  useEffect(() => {
    const ch = (supabase as any)
      .channel('admin-error-reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'error_reports' }, () => {
        if (soundOn) {
          import('@/lib/soundFx').then(m => m.playHornBeep?.()).catch(() => {});
        }
        void fetchKpis();
        if (page === 0) void fetchRows();
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [page, soundOn]);

  const resolve = async (id: string) => {
    const { error } = await (supabase as any).from('error_reports')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Erro ao resolver'); return; }
    await logAuditAction({ action: 'update', resource_type: 'error_reports', resource_id: id }).catch(() => {});
    toast.success('Erro marcado como resolvido');
    setRows(prev => prev.filter(r => r.id !== id));
    void fetchKpis();
  };

  const alertActive = kpis.last_hour >= threshold;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const sevBadge = (s: string) => {
    const map: Record<string, string> = {
      critical: 'bg-destructive text-destructive-foreground',
      error: 'bg-orange-500 text-white',
      warning: 'bg-yellow-500 text-black',
      info: 'bg-blue-500 text-white',
    };
    return map[s] || 'bg-muted text-muted-foreground';
  };

  const kpiCards = useMemo(() => ([
    { label: 'Última hora', value: kpis.last_hour, alert: alertActive },
    { label: '24h', value: kpis.last_24h },
    { label: '7 dias', value: kpis.last_7d },
    { label: 'Usuários afetados (24h)', value: kpis.users },
  ]), [kpis, alertActive]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Monitoramento de Erros</h1>
        {/* Banner de alerta */}
        {alertActive && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
                <div>
                  <p className="font-bold text-destructive">
                    Volume de erros acima do limite ({kpis.last_hour} na última hora, limite {threshold})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Limite configurável em <code>site_settings.error_reports_alert_threshold_per_hour</code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map(k => (
            <Card key={k.label} className={k.alert ? 'border-destructive' : ''}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-2xl font-bold ${k.alert ? 'text-destructive' : 'text-foreground'}`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Buscar em mensagem, componente, caminho…"
                className="pl-8"
              />
            </div>
            <Select value={severityFilter} onValueChange={v => { setSeverityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas severidades</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resolvedFilter} onValueChange={v => { setResolvedFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Em aberto</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => { void fetchRows(); void fetchKpis(); }} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setSoundOn(s => !s)} title={soundOn ? 'Som ligado' : 'Som desligado'}>
              {soundOn ? <Bell className="h-4 w-4 text-emerald-600" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Nenhum erro encontrado com esses filtros.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map(r => (
                  <li key={r.id} className="p-3 flex items-start gap-3 hover:bg-muted/30">
                    <Badge className={`${sevBadge(r.severity)} shrink-0 text-[10px] uppercase`}>{r.severity}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.error_message || '(sem mensagem)'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-mono">{r.page_path || '/'}</span>
                        {r.component_name && <> · {r.component_name}</>}
                        {' · '}{new Date(r.created_at).toLocaleString('pt-BR')}
                        {r.app_version && <> · v{r.app_version}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(r)} title="Detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!r.resolved && (
                        <Button variant="ghost" size="icon" onClick={() => void resolve(r.id)} title="Resolver">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {page + 1} de {totalPages} ({total} registros)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{detail?.error_message || 'Erro'}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Severidade:</strong> {detail.severity}</div>
                <div><strong>Quando:</strong> {new Date(detail.created_at).toLocaleString('pt-BR')}</div>
                <div className="col-span-2 truncate"><strong>Caminho:</strong> <span className="font-mono">{detail.page_path}</span></div>
                {detail.component_name && <div><strong>Componente:</strong> {detail.component_name}</div>}
                {detail.viewport && <div><strong>Viewport:</strong> {detail.viewport}</div>}
                {detail.app_version && <div><strong>Versão:</strong> {detail.app_version}</div>}
                {detail.build_id && <div className="truncate"><strong>Build:</strong> {detail.build_id}</div>}
                {detail.user_id && <div className="col-span-2 truncate"><strong>User:</strong> <span className="font-mono">{detail.user_id}</span></div>}
              </div>
              {detail.action_context && (
                <div>
                  <strong>Contexto:</strong>
                  <pre className="bg-muted/40 p-2 rounded mt-1 whitespace-pre-wrap break-all">{detail.action_context}</pre>
                </div>
              )}
              {detail.error_stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="bg-muted/40 p-2 rounded mt-1 whitespace-pre-wrap break-all max-h-64 overflow-auto">{detail.error_stack}</pre>
                </div>
              )}
              {detail.user_agent && (
                <div className="truncate"><strong>UA:</strong> <span className="font-mono">{detail.user_agent}</span></div>
              )}
              {Array.isArray(detail.action_history) && detail.action_history.length > 0 && (
                <div>
                  <strong>Histórico de ações:</strong>
                  <pre className="bg-muted/40 p-2 rounded mt-1 max-h-48 overflow-auto">
                    {JSON.stringify(detail.action_history, null, 2)}
                  </pre>
                </div>
              )}
              {!detail.resolved && (
                <Button onClick={() => { void resolve(detail.id); setDetail(null); }} className="w-full">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como resolvido
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminErrorReportsPage;
