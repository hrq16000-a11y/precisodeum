/**
 * Métricas de submissão ao Search Console (últimos 7/14/30 dias).
 *
 * Lê apenas `gsc_audit_log` (sem tabela nova). Latência vem de
 * `response->>duration_ms` quando a edge function registrou; sem dado, mostra "—".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AsyncBoundary, SkeletonCardGrid } from "@/components/motion";
import { toast } from "sonner";
import {
  computeGscMetrics,
  formatMs,
  pct,
  type GscMetrics,
  type GscMetricsRow,
  type MetricBucket,
} from "@/lib/seo/gscMetrics";

const WINDOWS = [7, 14, 30] as const;

const download = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const Kpi = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </div>
    <p
      className={`mt-1 text-2xl font-bold tabular-nums ${
        tone === "bad"
          ? "text-destructive"
          : tone === "warn"
            ? "text-amber-600 dark:text-amber-400"
            : tone === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground"
      }`}
    >
      {value}
    </p>
    {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const BucketTable = ({ title, description, buckets }: { title: string; description: string; buckets: MetricBucket[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="overflow-x-auto">
      {buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem submissões nesta janela.</p>
      ) : (
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border/60 text-left">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-right">Envios</th>
              <th className="py-2 pr-2 text-right">Falhas</th>
              <th className="py-2 pr-2 text-right">Taxa de falha</th>
              <th className="py-2 pr-2 text-right">% do total</th>
              <th className="py-2 pr-2 text-right">Média</th>
              <th className="py-2 pr-2 text-right">p95</th>
              <th className="py-2 pr-2 text-right">Último</th>
            </tr>
          </thead>
          <tbody className="motion-stagger">
            {buckets.map((b) => (
              <tr key={b.key} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-2 font-medium">{b.key}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{b.total}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{b.failed}</td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  <Badge variant={b.failureRate > 0.2 ? "destructive" : b.failureRate > 0 ? "secondary" : "outline"}>
                    {pct(b.failureRate)}
                  </Badge>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{pct(b.share)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatMs(b.avgMs)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatMs(b.p95Ms)}</td>
                <td className="py-2 pr-2 text-right text-xs text-muted-foreground">
                  {b.lastAt ? new Date(b.lastAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CardContent>
  </Card>
);

const DailyBars = ({ metrics }: { metrics: GscMetrics }) => {
  const max = Math.max(1, ...metrics.daily.map((d) => d.total));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submissões por dia</CardTitle>
        <CardDescription>Volume total e parcela com falha na janela selecionada.</CardDescription>
      </CardHeader>
      <CardContent>
        {metrics.daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma submissão registrada.</p>
        ) : (
          <div className="flex items-end gap-2 overflow-x-auto pb-2">
            {metrics.daily.map((d) => (
              <div key={d.date} className="flex min-w-10 flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center">
                  <div
                    className="relative w-6 overflow-hidden rounded-t bg-primary/25"
                    style={{ height: `${Math.round((d.total / max) * 100)}%`, transition: "height var(--motion-base, 220ms) ease-out" }}
                    title={`${d.total} envios · ${d.failed} falhas`}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-destructive/80"
                      style={{ height: `${Math.round((d.failed / Math.max(1, d.total)) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AdminSeoMetricsPage = () => {
  const [rows, setRows] = useState<GscMetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [days, setDays] = useState<number>(7);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("gsc_audit_log")
      .select("id, action, site, sitemap, status, ok, error, response, created_at")
      .eq("action", "submit-sitemap")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (err) setError(err);
    else {
      setRows(
        ((data ?? []) as Array<GscMetricsRow & { response?: { duration_ms?: number } | null }>).map((r) => ({
          ...r,
          duration_ms:
            typeof r.response?.duration_ms === "number" ? r.response.duration_ms : null,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => computeGscMetrics(rows, { days }), [rows, days]);

  const exportMetrics = () => {
    try {
      download(
        JSON.stringify(metrics, null, 2),
        `gsc-metricas-${days}d-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json",
      );
    } catch (err) {
      toast.error(`Falha ao exportar: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-4 motion-enter">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" aria-hidden />
              Métricas de submissão (GSC)
            </CardTitle>
            <CardDescription>
              Contagem, tempo de resposta, taxa de falhas e percentuais por sitemap e partição.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    {w} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportMetrics}>
              <Download className="h-4 w-4" aria-hidden />
              JSON
            </Button>
          </div>
        </CardHeader>
      </Card>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && metrics.total === 0}
        skeleton={<SkeletonCardGrid count={4} />}
        emptyTitle="Nenhuma submissão nesta janela"
        emptyDescription="Rode uma submissão em Submissões GSC para começar a coletar métricas."
        onRetry={() => void load()}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi icon={Activity} label="Submissões" value={String(metrics.total)} hint={`${metrics.runs} rodada(s)`} />
            <Kpi icon={CheckCircle2} label="Sucesso" value={String(metrics.ok)} tone="ok" />
            <Kpi
              icon={AlertTriangle}
              label="Falhas"
              value={String(metrics.failed)}
              tone={metrics.failed > 0 ? "bad" : "ok"}
            />
            <Kpi
              icon={AlertTriangle}
              label="Taxa de falha"
              value={pct(metrics.failureRate)}
              tone={metrics.failureRate > 0.1 ? "bad" : metrics.failureRate > 0 ? "warn" : "ok"}
            />
            <Kpi
              icon={Clock}
              label="Tempo de resposta"
              value={formatMs(metrics.avgMs)}
              hint={`p95 ${formatMs(metrics.p95Ms)}`}
            />
          </div>

          <DailyBars metrics={metrics} />

          <BucketTable
            title="Por sitemap"
            description="Agrupado pelo sitemap enviado (index e sub-mapas)."
            buckets={metrics.perSitemap}
          />
          <BucketTable
            title="Por partição"
            description="Fatia de cada partição no volume total e na taxa de falha."
            buckets={metrics.perPartition}
          />
        </div>
      </AsyncBoundary>
    </div>
  );
};

export default AdminSeoMetricsPage;
