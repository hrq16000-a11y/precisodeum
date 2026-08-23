/**
 * DashboardCadastroStatusPage — tela "Status do cadastro" para o usuário.
 *
 * - Lista os eventos do funil de cadastro do PRÓPRIO usuário (RLS já filtra)
 * - Destaca eventos do tipo `error` com a mensagem amigável e o contexto
 * - Mostra a etapa atual estimada (último `phase_view`/`phase_complete`)
 * - Permite filtrar por tipo (todos / só erros) e recarregar
 *
 * Origem dos dados: tabela `onboarding_events` (PII já é mascarada na escrita,
 * via wizardErrorGuard.stripPii — nada sensível chega aqui).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/lib/router-compat';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Activity,
  Clock,
  ChevronRight,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthIdentity } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import DashboardGroupNav from '@/components/dashboard/DashboardGroupNav';
import { useSeoHead } from '@/hooks/useSeoHead';

interface EventRow {
  id: string;
  phase: string;
  event: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 25;

const eventLabel: Record<string, string> = {
  error: 'Erro',
  phase_view: 'Visualizou etapa',
  phase_complete: 'Concluiu etapa',
  phase_skip: 'Pulou etapa',
  abandon: 'Abandonou',
  submit: 'Enviou',
  retry: 'Tentou novamente',
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));

const DashboardCadastroStatusPage = () => {
  const { user } = useAuthIdentity();
  useSeoHead({
    title: 'Status do cadastro — Precisodeum',
    description: 'Acompanhe os eventos e diagnósticos do seu cadastro.',
    noindex: true,
  });

  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'errors'>('all');

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('onboarding_events')
        .select('id, phase, event, meta, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (filter === 'errors') q = q.eq('event', 'error');
      const { data, error } = await q;
      if (error) {
        console.error('[CadastroStatus] erro carregando eventos', error);
        setRows([]);
      } else {
        setRows((data || []) as EventRow[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filter]);

  const errorCount = useMemo(() => rows.filter((r) => r.event === 'error').length, [rows]);
  const lastPhase = useMemo(() => {
    const lastView = rows.find((r) => r.event === 'phase_view' || r.event === 'phase_complete');
    return lastView?.phase || null;
  }, [rows]);

  const visibleRows = rows.slice(0, page * PAGE_SIZE);
  const hasMore = rows.length > visibleRows.length;

  if (!user) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Você precisa estar logado para ver o status do cadastro.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <DashboardGroupNav />

      <header className="mb-5 space-y-1.5">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <h1 className="text-xl font-bold leading-tight">Status do cadastro</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Veja o histórico de etapas e qualquer falha que tenha impedido seu cadastro de avançar.
        </p>
      </header>

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="rounded-full bg-primary/10 p-2">
            <Clock className="h-4 w-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Etapa mais recente</p>
            <p className="truncate text-sm font-semibold">{lastPhase || '—'}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className={`rounded-full p-2 ${errorCount > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10'}`}>
            {errorCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.75} />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Erros registrados</p>
            <p className="text-sm font-semibold">{errorCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="rounded-full bg-primary/10 p-2">
            <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Privacidade</p>
            <p className="text-sm font-semibold">Sem dados sensíveis</p>
          </div>
        </Card>
      </div>

      {/* Controles */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => { setFilter('all'); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => { setFilter('errors'); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'errors' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Apenas erros
          </button>
        </div>

        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
          Atualizar
        </Button>

        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link to="/cadastro-inicial">
            Retomar cadastro <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Lista */}
      {loading && rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando histórico...
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center">
          <Inbox className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-sm font-semibold">Nenhum evento registrado ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === 'errors'
              ? 'Não há erros associados ao seu cadastro. Tudo certo até agora.'
              : 'Quando você iniciar o cadastro, os eventos aparecerão aqui.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((row) => {
            const isError = row.event === 'error';
            const meta = row.meta || {};
            const message = (meta as any).message || (meta as any).context?.action || null;
            const code = (meta as any).code || null;
            const hint = (meta as any).hint || null;
            return (
              <Card
                key={row.id}
                className={`p-3 ${isError ? 'border-destructive/40 bg-destructive/5' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isError ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                    {eventLabel[row.event] || row.event}
                  </Badge>
                  <span className="text-xs font-medium">{row.phase}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </span>
                </div>
                {(message || code || hint) && (
                  <div className="mt-2 space-y-0.5 rounded-md bg-background/60 p-2 text-[11px] text-muted-foreground">
                    {message && (
                      <p>
                        <span className="font-semibold text-foreground">Mensagem:</span>{' '}
                        <span className="break-words">{String(message).slice(0, 240)}</span>
                      </p>
                    )}
                    {code && (
                      <p>
                        <span className="font-semibold text-foreground">Código:</span>{' '}
                        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{String(code)}</code>
                      </p>
                    )}
                    {hint && (
                      <p>
                        <span className="font-semibold text-foreground">Dica:</span>{' '}
                        {String(hint).slice(0, 240)}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Estes registros são usados para ajudar nosso suporte a identificar falhas no seu cadastro.
        Nenhum dado sensível (nome, telefone, e-mail, CPF) é armazenado aqui.
      </p>
    </div>
  );
};

export default DashboardCadastroStatusPage;
