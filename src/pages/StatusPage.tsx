import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, APP_BUILD_ID } from "@/lib/appVersion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

type Check = {
  name: string;
  ok: boolean;
  status: number | null;
  latency_ms: number;
  detail?: string;
};

type HealthPayload = {
  status: "ok" | "degraded" | "down";
  checked_at: string;
  site_url: string;
  checks: Check[];
};

const CHECK_LABELS: Record<string, string> = {
  auth: "Autenticação",
  gsc_verify: "Search Console (acesso restrito)",
  search: "Busca / banco de dados",
  sitemap: "Sitemap",
};

const STATUS_COPY: Record<HealthPayload["status"], { label: string; className: string }> = {
  ok: { label: "Tudo operacional", className: "text-emerald-600 dark:text-emerald-400" },
  degraded: { label: "Operação parcial", className: "text-amber-600 dark:text-amber-400" },
  down: { label: "Indisponível", className: "text-destructive" },
};

export default function StatusPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("health-check", {
        method: "GET",
      });
      if (err) throw err;
      setData(res as HealthPayload);
    } catch (err) {
      setError((err as Error)?.message || "Não foi possível consultar a integridade agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overall = data ? STATUS_COPY[data.status] : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Helmet>
        <title>Status da plataforma | Preciso de um</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content="Página de status e integridade da plataforma Preciso de um." />
      </Helmet>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Status da plataforma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verificação em tempo real de autenticação, banco de dados, rotas restritas e sitemap.
        </p>
      </header>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            ) : data?.status === "ok" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : data?.status === "degraded" ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" aria-hidden />
            )}
            <span className={`font-semibold ${overall?.className ?? ""}`}>
              {loading ? "Verificando…" : (overall?.label ?? "Sem resposta")}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Atualizar
          </Button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Versão</dt>
            <dd className="font-mono font-medium">{APP_VERSION}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Build</dt>
            <dd className="truncate font-mono font-medium" title={APP_BUILD_ID}>{APP_BUILD_ID}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Última checagem</dt>
            <dd className="font-medium">
              {data?.checked_at ? new Date(data.checked_at).toLocaleTimeString("pt-BR") : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      {error && (
        <Card className="mb-6 border-destructive/40 p-4 text-sm text-destructive">{error}</Card>
      )}

      <ul className="space-y-3">
        {(data?.checks ?? []).map((check) => (
          <li key={check.name}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                {check.ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                )}
                <div>
                  <p className="font-medium">{CHECK_LABELS[check.name] ?? check.name}</p>
                  {check.detail && (
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>HTTP {check.status ?? "—"}</p>
                <p>{check.latency_ms} ms</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
