/**
 * AdminKillSwitchBlocksPage
 *
 * Lista todas as tentativas de cadastro/edição de serviço que foram
 * bloqueadas pelo trigger `enforce_service_city_coherence` (kill-switch).
 * Cada linha mostra motivo, payload completo da tentativa e o prestador.
 * O admin pode reprocessar a correção via RPC quando aplicável.
 */
import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, RefreshCw, Loader2, ChevronDown, ChevronUp, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BlockRow {
  id: string;
  service_id: string | null;
  provider_id: string | null;
  provider_name: string | null;
  reason: string | null;
  source: string | null;
  attempt_payload: Record<string, any> | null;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  forbidden_term_block: 'Termo proibido (anti-leilão)',
  city_mismatch_block: 'Cidade fora do catálogo IBGE',
  city_mismatch_autofix: 'Divergência city ↔ service_area',
};

const AdminKillSwitchBlocksPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [providerFilter, setProviderFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fetching, setFetching] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase.rpc(
      'admin_list_kill_switch_blocks' as any,
      {
        p_provider_id: providerFilter.trim() || null,
        p_from: from ? `${from}T00:00:00` : null,
        p_to: to ? `${to}T23:59:59` : null,
        p_limit: 200,
      },
    );
    setFetching(false);
    if (error) {
      toast.error('Erro ao listar bloqueios: ' + error.message);
      return;
    }
    setRows((data ?? []) as BlockRow[]);
  }, [providerFilter, from, to]);

  useEffect(() => {
    if (isAdmin) fetchRows();
  }, [isAdmin, fetchRows]);

  const reprocess = async (id: string) => {
    setReprocessing(id);
    const { data, error } = await supabase.rpc('admin_reprocess_kill_switch_block' as any, {
      p_correction_id: id,
    });
    setReprocessing(null);
    if (error) {
      toast.error('Falha ao reprocessar: ' + error.message);
      return;
    }
    const result = data as { success?: boolean; service_updated?: boolean; new_service_area?: string | null; error?: string };
    if (result?.success) {
      toast.success('Bloqueio reprocessado', {
        description: result.service_updated
          ? `Serviço sincronizado para "${result.new_service_area}".`
          : 'Auditoria registrada (sem serviço para atualizar).',
      });
      fetchRows();
    } else {
      toast.error('Não reprocessado: ' + (result?.error || 'erro desconhecido'));
    }
  };

  if (loading) {
    return <AdminLayout><div className="p-6"><Loader2 className="animate-spin" /></div></AdminLayout>;
  }
  if (!isAdmin) {
    return <AdminLayout><div className="p-6 text-destructive">Acesso restrito.</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h1 className="text-2xl font-bold">Bloqueios kill-switch</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Tentativas de cadastro/edição rejeitadas pelo trigger de coerência (cidade fora do catálogo, termos de leilão ou divergência crítica). Cada bloqueio inclui o payload completo da tentativa para análise.
        </p>

        <Card className="p-4 grid gap-3 sm:grid-cols-4 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Provider ID</label>
            <Input value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">De</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={fetchRows} disabled={fetching}>
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Atualizar</span>
          </Button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{rows.length} bloqueio(s)</h2>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum bloqueio encontrado no período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const isOpen = !!expanded[r.id];
                return (
                  <li key={r.id} className="py-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="destructive" className="text-[10px]">
                            {REASON_LABEL[r.reason || ''] || r.reason || 'Bloqueio'}
                          </Badge>
                          {r.source && <Badge variant="outline" className="text-[10px]">{r.source}</Badge>}
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {r.provider_name || r.provider_id || '— prestador desconhecido'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tentativa: <code className="bg-muted px-1 rounded">{r.previous_value || '—'}</code>
                          {r.new_value && <> → <code className="bg-muted px-1 rounded">{r.new_value}</code></>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpanded(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                        >
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          <span className="ml-1 text-xs">Payload</span>
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => reprocess(r.id)}
                          disabled={reprocessing === r.id || !r.service_id}
                          title={!r.service_id ? 'Sem serviço associado para reprocessar' : 'Reprocessar correção'}
                        >
                          {reprocessing === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <PlayCircle className="h-3 w-3" />
                          )}
                          <span className="ml-1 text-xs">Reprocessar</span>
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <pre className="mt-2 rounded-md bg-muted/40 p-2 text-[11px] overflow-x-auto max-h-64">
                        {JSON.stringify(r.attempt_payload ?? {}, null, 2)}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminKillSwitchBlocksPage;
