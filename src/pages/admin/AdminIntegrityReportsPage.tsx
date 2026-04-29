/**
 * AdminIntegrityReportsPage — Histórico das rotinas diárias de integridade.
 *
 * Mostra os relatórios gerados por `run_integrity_check()` (cron diário às 03:00),
 * com totais e detalhamento por categoria. Permite executar manualmente.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, ShieldAlert, Database } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { useSeoHead } from '@/hooks/useSeoHead';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

interface Row {
  id: string;
  ran_at: string;
  scope: string;
  finding_count: number;
  details: Record<string, number> | null;
}

const labels: Record<string, string> = {
  providers_without_services: 'Profissionais sem serviços',
  services_without_category: 'Serviços sem categoria',
  providers_null_city: 'Profissionais sem cidade',
  providers_null_neighborhood: 'Profissionais sem bairro',
  services_null_name: 'Serviços sem nome',
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('integrity_reports' as any)
      .select('id, ran_at, scope, finding_count, details')
      .order('ran_at', { ascending: false })
      .limit(60);
    if (error) {
      toast.error('Falha ao carregar relatórios');
      setRows([]);
    } else {
      setRows((data || []) as unknown as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

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
    <>
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <div>
              <h1 className="text-xl font-bold">Integridade de dados</h1>
              <p className="text-xs text-muted-foreground">Validação diária automática às 03:00</p>
            </div>
          </div>
          <Button onClick={runNow} disabled={running} size="sm">
            {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
            Executar agora
          </Button>
        </header>

        {last && (
          <Card className={`mb-4 p-4 ${last.finding_count > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
            <div className="flex items-center gap-2 mb-2">
              {last.finding_count > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <span className="font-semibold text-sm">
                Última verificação — {fmt(last.ran_at)}
              </span>
              <Badge variant={last.finding_count > 0 ? 'destructive' : 'secondary'} className="ml-auto">
                {last.finding_count} achados
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
              {Object.entries(last.details || {}).map(([k, v]) => (
                <div key={k} className="rounded-md bg-background/60 p-2 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">{labels[k] || k}</span>
                  <span className={`font-bold ${v > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" /> Histórico
        </h2>

        {loading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum relatório ainda.
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{r.scope}</Badge>
                  <span className="text-xs">{fmt(r.ran_at)}</span>
                  <Badge
                    variant={r.finding_count > 0 ? 'destructive' : 'secondary'}
                    className="ml-auto"
                  >
                    {r.finding_count} achados
                  </Badge>
                </div>
                {r.details && Object.keys(r.details).length > 0 && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                    {Object.entries(r.details).map(([k, v]) => (
                      <span key={k} className="text-muted-foreground">
                        {labels[k] || k}: <strong className={v > 0 ? 'text-amber-700' : 'text-foreground'}>{v}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminGuard>
  );
};

export default AdminIntegrityReportsPage;
