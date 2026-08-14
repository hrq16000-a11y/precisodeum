/**
 * AdminTrackingHealthPage — Fase A · item 3
 *
 * Saúde dos RPCs de tracking (sponsor, search intent e funil público).
 * Lê `admin_tracking_rpc_health_summary` e `admin_tracking_rpc_health_errors`,
 * alimentados pelo wrapper `src/lib/tracking/safeRpc.ts` (amostragem: 100%
 * dos erros, 5% dos sucessos).
 *
 * Objetivo: nunca mais ficar "silenciosamente quebrado" com 42501.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSeoHead } from '@/hooks/useSeoHead';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SummaryRow {
  rpc_name: string;
  total: number;
  successes: number;
  errors: number;
  error_rate: number | null;
  permission_denied: number;
  avg_latency_ms: number | null;
  last_error_at: string | null;
  top_error_code: string | null;
}

interface ErrorRow {
  created_at: string;
  rpc_name: string;
  error_code: string | null;
  error_message: string | null;
  pathname: string | null;
  is_authenticated: boolean;
}

const WINDOWS = [1, 24, 168] as const;
const WINDOW_LABEL: Record<number, string> = { 1: '1h', 24: '24h', 168: '7 dias' };

/** Limiar de alerta: acima disso a linha fica destacada como crítica. */
export const ERROR_RATE_ALERT_PCT = 5;

export function severityOf(row: Pick<SummaryRow, 'error_rate' | 'permission_denied'>):
  | 'ok'
  | 'warning'
  | 'critical' {
  if ((row.permission_denied ?? 0) > 0) return 'critical';
  if ((row.error_rate ?? 0) >= ERROR_RATE_ALERT_PCT) return 'warning';
  return 'ok';
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="motion-enter">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminTrackingHealthPage() {
  const [hours, setHours] = useState<number>(24);

  useSeoHead({
    title: 'Saúde do tracking | Admin',
    description: 'Taxa de sucesso e erro dos RPCs de tracking.',
    noindex: true,
  });

  const summary = useQuery({
    queryKey: ['admin-tracking-health', hours],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        'admin_tracking_rpc_health_summary',
        { _hours: hours },
      );
      if (error) throw error;
      return (data || []) as SummaryRow[];
    },
    staleTime: 60_000,
  });

  const errors = useQuery({
    queryKey: ['admin-tracking-errors', hours],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        'admin_tracking_rpc_health_errors',
        { _hours: hours, _limit: 100 },
      );
      if (error) throw error;
      return (data || []) as ErrorRow[];
    },
    staleTime: 60_000,
  });

  const rows = summary.data ?? [];

  const totals = useMemo(() => {
    const total = rows.reduce((a, r) => a + Number(r.total || 0), 0);
    const errs = rows.reduce((a, r) => a + Number(r.errors || 0), 0);
    const denied = rows.reduce((a, r) => a + Number(r.permission_denied || 0), 0);
    return {
      total,
      errs,
      denied,
      rate: total ? ((errs / total) * 100).toFixed(2) : '0.00',
    };
  }, [rows]);

  const critical = rows.filter((r) => severityOf(r) === 'critical');

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Saúde do tracking</h1>
          <p className="text-sm text-muted-foreground">
            Amostra reportada pelo cliente: 100% dos erros, 5% dos sucessos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              size="sm"
              variant={hours === w ? 'default' : 'outline'}
              onClick={() => setHours(w)}
            >
              {WINDOW_LABEL[w]}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void summary.refetch();
              void errors.refetch();
            }}
            aria-label="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {critical.length > 0 ? (
        <Card className="border-destructive/50 bg-destructive/5 motion-enter">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">
                Permission denied (42501) detectado
              </p>
              <p className="text-muted-foreground">
                {critical.map((c) => c.rpc_name).join(', ')} — verifique o GRANT EXECUTE
                para o papel anônimo.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        <Kpi label="Chamadas amostradas" value={totals.total} />
        <Kpi label="Erros" value={totals.errs} />
        <Kpi label="Taxa de erro" value={`${totals.rate}%`} hint={`Alerta ≥ ${ERROR_RATE_ALERT_PCT}%`} />
        <Kpi label="Permission denied" value={totals.denied} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por RPC</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : summary.error ? (
            <p className="text-sm text-destructive">
              Não foi possível carregar os dados (acesso restrito a administradores).
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma amostra na janela selecionada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RPC</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">42501</TableHead>
                  <TableHead className="text-right">Latência méd.</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const sev = severityOf(r);
                  return (
                    <TableRow key={r.rpc_name}>
                      <TableCell className="font-mono text-xs">{r.rpc_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.errors}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(r.error_rate ?? 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.permission_denied}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.avg_latency_ms != null ? `${r.avg_latency_ms} ms` : '—'}
                      </TableCell>
                      <TableCell>
                        {sev === 'critical' ? (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="h-3 w-3" /> crítico
                          </Badge>
                        ) : sev === 'warning' ? (
                          <Badge variant="secondary" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> atenção
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> ok
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Erros recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (errors.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>RPC</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(errors.data ?? []).map((e, i) => (
                  <TableRow key={`${e.created_at}-${i}`}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.rpc_name}</TableCell>
                    <TableCell>
                      <Badge variant={e.error_code === '42501' ? 'destructive' : 'outline'}>
                        {e.error_code ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[16rem] truncate">
                      {e.pathname ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs max-w-[24rem] truncate">
                      {e.error_message ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
