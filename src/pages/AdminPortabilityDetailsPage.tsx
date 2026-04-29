import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Loader2,
  Database, Code2, History,
} from "lucide-react";

type HealthResult = {
  ok: boolean;
  checked_at: string;
  rpcs: { name: string; ok: boolean }[];
  columns: { table: string; column: string; ok: boolean }[];
};

type HistoryRow = {
  id: string;
  created_at: string;
  ok: boolean;
  source: string;
  failed_rpcs: string[];
  failed_columns: { table: string; column: string }[];
};

const RPC_DOCS: Record<string, string> = {
  register_service_completion: "Registra conclusão de serviço (gamificação).",
  audit_user_ref_health: "Auditoria global do user_ref.",
  validate_db_health: "Verificação de saúde usada pelo dashboard.",
  has_role: "Checagem de papel (admin/etc) para RLS.",
  nearby_providers: "Busca por proximidade na home/categoria.",
};

export default function AdminPortabilityDetailsPage() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: h, error: e1 }, { data: hist, error: e2 }] = await Promise.all([
        supabase.rpc("validate_db_health" as never),
        supabase
          .from("health_check_history" as never)
          .select("id,created_at,ok,source,failed_rpcs,failed_columns")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (e1) throw e1;
      setHealth(h as unknown as HealthResult);
      if (!e2) setHistory((hist as unknown as HistoryRow[]) ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const failedRpcs = health?.rpcs.filter((r) => !r.ok) ?? [];
  const failedCols = health?.columns.filter((c) => !c.ok) ?? [];
  const lastFailures = history.filter((h) => !h.ok).slice(0, 10);

  return (
    <AdminLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-5 max-w-5xl">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/admin/portabilidade">
            <ArrowLeft className="size-4 mr-1" />Voltar para Portabilidade
          </Link>
        </Button>

        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Detalhes de saúde do banco</h1>
            <p className="text-sm text-muted-foreground">
              Falhas específicas (colunas, índices, RPCs) com links de correção e reexecução.
            </p>
          </div>
          <Button onClick={reload} disabled={loading} variant="outline" size="sm">
            {loading
              ? <Loader2 className="size-4 mr-2 animate-spin" />
              : <RefreshCw className="size-4 mr-2" />}
            Reexecutar checks
          </Button>
        </header>

        {/* Status geral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {health?.ok
                ? <><CheckCircle2 className="size-5 text-green-600" />Banco íntegro</>
                : <><AlertTriangle className="size-5 text-destructive" />Inconsistências detectadas</>}
            </CardTitle>
            <CardDescription>
              Última verificação: {health?.checked_at
                ? new Date(health.checked_at).toLocaleString("pt-BR")
                : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">RPCs verificadas</div>
              <div className="text-2xl font-bold">{health?.rpcs.length ?? 0}</div>
              <div className={`text-xs ${failedRpcs.length ? "text-destructive" : "text-green-600"}`}>
                {failedRpcs.length} falhas
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Colunas verificadas</div>
              <div className="text-2xl font-bold">{health?.columns.length ?? 0}</div>
              <div className={`text-xs ${failedCols.length ? "text-destructive" : "text-green-600"}`}>
                {failedCols.length} falhas
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Falhas registradas (30d)</div>
              <div className="text-2xl font-bold">{lastFailures.length}</div>
              <div className="text-xs text-muted-foreground">últimos 50 registros</div>
            </div>
          </CardContent>
        </Card>

        {/* RPCs falhas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code2 className="size-4" />RPCs ausentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {failedRpcs.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma RPC ausente.</p>
            )}
            {failedRpcs.map((r) => (
              <div key={r.name} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <code className="font-mono text-sm font-semibold">{r.name}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {RPC_DOCS[r.name] ?? "Função usada por componentes do app."}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Correção: aplicar a última migração (<code>supabase db push</code> ou
                    rodar a migration mais recente em <code>supabase/migrations/</code>).
                  </p>
                </div>
                <Badge variant="destructive">ausente</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Colunas falhas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4" />Colunas ausentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {failedCols.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma coluna crítica ausente.</p>
            )}
            {failedCols.map((c) => (
              <div key={`${c.table}.${c.column}`} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <code className="font-mono text-sm font-semibold">{c.table}.{c.column}</code>
                  <Badge variant="destructive">ausente</Badge>
                </div>
                <pre className="text-[11px] bg-muted/50 rounded p-2 mt-2 overflow-x-auto font-mono">
{`ALTER TABLE public.${c.table} ADD COLUMN ${c.column} <tipo>;`}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />Histórico (últimos 50)
            </CardTitle>
            <CardDescription>
              Registros de <code>health_check_history</code> — auditoria contínua em background.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2">Quando</th>
                    <th className="text-left p-2">Origem</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-left p-2">RPCs ausentes</th>
                    <th className="text-left p-2">Colunas ausentes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sem registros ainda.</td></tr>
                  )}
                  {history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="p-2 text-xs">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-2 text-xs">{h.source}</td>
                      <td className="p-2 text-center">
                        {h.ok
                          ? <CheckCircle2 className="size-4 text-green-600 inline" />
                          : <AlertTriangle className="size-4 text-destructive inline" />}
                      </td>
                      <td className="p-2 text-xs font-mono">
                        {h.failed_rpcs?.length ? h.failed_rpcs.join(", ") : "—"}
                      </td>
                      <td className="p-2 text-xs font-mono">
                        {h.failed_columns?.length
                          ? h.failed_columns.map((c) => `${c.table}.${c.column}`).join(", ")
                          : "—"}
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
}
