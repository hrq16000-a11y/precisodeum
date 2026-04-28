/**
 * AdminServiceAreaCorrectionsPage
 *
 * Lista todas as correções automáticas/manuais de service_area
 * (antes/depois, motivo, fonte, autor) com filtros por provider,
 * cidade e período. Também permite executar o job de sincronização
 * provider.city <-> services em modo dry-run ou efetivo.
 *
 * Backed por:
 *  - RPC admin_list_service_area_corrections(p_provider_id, p_city, p_from, p_to, p_limit)
 *  - RPC admin_sync_provider_city_with_services(p_dry_run)
 */
import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPinned, RefreshCw, PlayCircle, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  triggered_by: string;
  dry_run: boolean;
  affected_count: number;
  status: string;
  error_message: string | null;
  timezone: string | null;
}

interface Correction {
  id: string;
  service_id: string;
  provider_id: string;
  provider_name: string | null;
  previous_value: string | null;
  new_value: string | null;
  reason: string | null;
  source: string | null;
  corrected_by: string | null;
  corrector_name: string | null;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  city_mismatch_autofix: 'Divergência city ↔ service_area',
  periodic_sync_autofix: 'Sincronização periódica',
  legacy_prefix_strip: 'Limpeza de prefixo legado',
};

const SOURCE_LABEL: Record<string, string> = {
  trigger: 'Trigger automático',
  cron_job: 'Job periódico',
  admin_manual: 'Correção manual',
};

const AdminServiceAreaCorrectionsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [rows, setRows] = useState<Correction[]>([]);
  const [providerFilter, setProviderFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fetching, setFetching] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [tz, setTz] = useState<string>('America/Sao_Paulo');

  const fetchRuns = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_service_area_sync_runs' as any, { p_limit: 30 });
    setRuns((data ?? []) as SyncRun[]);
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'service_area_sync_timezone')
      .maybeSingle();
    if (setting?.value) setTz(String(setting.value).replace(/^"|"$/g, ''));
  }, []);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase.rpc(
      'admin_list_service_area_corrections' as any,
      {
        p_provider_id: providerFilter.trim() || null,
        p_city: cityFilter.trim() || null,
        p_from: from ? `${from}T00:00:00` : null,
        p_to: to ? `${to}T23:59:59` : null,
        p_limit: 200,
      },
    );
    setFetching(false);
    if (error) {
      toast.error('Erro ao listar correções: ' + error.message);
      return;
    }
    setRows((data ?? []) as Correction[]);
  }, [providerFilter, cityFilter, from, to]);

  useEffect(() => {
    if (isAdmin) {
      fetchRows();
      fetchRuns();
    }
  }, [isAdmin, fetchRows, fetchRuns]);

  const runSync = async (dryRun: boolean) => {
    setRunning(true);
    const { data, error } = await supabase.rpc(
      'admin_sync_provider_city_with_services' as any,
      { p_dry_run: dryRun },
    );
    setRunning(false);
    if (error) {
      toast.error('Erro no job: ' + error.message);
      return;
    }
    const n = (data as any[] | null)?.length ?? 0;
    toast.success(
      dryRun
        ? `${n} divergência(s) encontradas (dry-run, nada alterado).`
        : `${n} serviço(s) sincronizados com a cidade do provider.`,
    );
    if (!dryRun) fetchRows();
    fetchRuns();
  };

  if (loading) {
    return (
      <AdminLayout>
        <p className="p-4 text-muted-foreground">Carregando…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPinned className="h-6 w-6" /> Auditoria — Correções de service_area
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de mudanças automáticas (trigger), job periódico e correções manuais.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runSync(true)}
            disabled={running}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <PlayCircle className="h-4 w-4" />
            Dry-run
          </Button>
          <Button
            onClick={() => runSync(false)}
            disabled={running}
            size="sm"
            className="gap-1.5"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Executar sync
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mt-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase">Provider ID</label>
            <Input
              placeholder="UUID do provider"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase">Cidade</label>
            <Input
              placeholder="Ex.: Curitiba"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase">De</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={fetchRows} disabled={fetching} size="sm" variant="outline" className="gap-1.5">
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Aplicar filtros
          </Button>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        <strong className="font-semibold text-foreground">{rows.length}</strong> correção(ões) encontradas
      </p>

      <div className="mt-2 space-y-2">
        {rows.length === 0 && !fetching && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Nenhuma correção registrada com esses filtros.</p>
          </Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.provider_name || r.provider_id.slice(0, 8)}
                  </p>
                  {r.source && (
                    <Badge variant="outline" className="text-[10px]">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </Badge>
                  )}
                  {r.reason && (
                    <Badge variant="secondary" className="text-[10px]">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    {r.previous_value || '(vazio)'}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="rounded bg-green-100 px-1.5 py-0.5 font-mono text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {r.new_value || '(vazio)'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.corrector_name && <>por <span className="font-medium">{r.corrector_name}</span> · </>}
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                  <span className="ml-2 font-mono opacity-60">svc#{r.service_id.slice(0, 8)}</span>
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminServiceAreaCorrectionsPage;
