import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, Clock, TrendingUp, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MetricRow {
  duration_ms: number;
  succeeded: boolean;
  attempts: number;
  recorded_at: string;
}

interface ErrorEventRow {
  path: string;
  code: number;
}

interface ErrorReportRow {
  action_context: string | null;
  created_at: string;
}

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const AuthHealthPanel = () => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: metrics = [] } = useQuery({
    queryKey: ["auth-profile-metrics-24h"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("auth_profile_metrics" as any) as any)
        .select("duration_ms, succeeded, attempts, recorded_at")
        .gte("recorded_at", since24h)
        .order("recorded_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as MetricRow[];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: timeoutEvents = [] } = useQuery({
    queryKey: ["auth-profile-timeouts-1h"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("error_reports" as any) as any)
        .select("action_context, created_at")
        .eq("action_context", "auth.profile_timeout")
        .gte("created_at", since1h)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as ErrorReportRow[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: errorEvents = [] } = useQuery({
    queryKey: ["error-page-events-7d"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("error_page_events" as any) as any)
        .select("path, code")
        .gte("occurred_at", since7d)
        .limit(2000);
      if (error) throw error;
      return (data || []) as ErrorEventRow[];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const sortedDurations = metrics.map((m) => m.duration_ms).sort((a, b) => a - b);
  const p50 = percentile(sortedDurations, 50);
  const p95 = percentile(sortedDurations, 95);
  const p99 = percentile(sortedDurations, 99);
  const failures = metrics.filter((m) => !m.succeeded).length;
  const total = metrics.length;
  const failureRate = total > 0 ? Math.round((failures / total) * 100) : 0;
  const timeouts1h = timeoutEvents.length;
  const timeoutAlert = timeouts1h > 5;

  // Top paths grouping
  const grouped = new Map<string, { code: number; count: number }>();
  for (const e of errorEvents) {
    const key = `${e.code}|${e.path}`;
    const cur = grouped.get(key);
    if (cur) cur.count += 1;
    else grouped.set(key, { code: e.code, count: 1 });
  }
  const topPaths = Array.from(grouped.entries())
    .map(([key, v]) => ({ path: key.split("|").slice(1).join("|"), code: v.code, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${timeoutAlert ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
              <Activity className={`h-5 w-5 ${timeoutAlert ? "text-red-600" : "text-emerald-600"}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Performance de Auth (Profile)</h3>
              <p className="text-[11px] text-muted-foreground">
                Telemetria de carregamento do perfil · últimas 24h
              </p>
            </div>
          </div>
          {timeoutAlert && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              {timeouts1h} timeouts/1h
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded-xl border border-border/40 bg-background/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Amostras</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{total}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">p50</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{p50}ms</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">p95</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${p95 > 2000 ? "text-amber-600" : "text-foreground"}`}>{p95}ms</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">p99</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${p99 > 5000 ? "text-red-600" : "text-foreground"}`}>{p99}ms</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Falhas</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${failureRate > 5 ? "text-red-600" : "text-foreground"}`}>
              {failures} ({failureRate}%)
            </p>
          </div>
        </div>

        {timeoutAlert && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              <p className="font-semibold">Alerta: {timeouts1h} ocorrências de auth.profile_timeout na última hora.</p>
              <p className="mt-0.5 opacity-90">Limite recomendado: 5/h. Investigar latência do banco ou trigger handle_new_user.</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <FileWarning className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Top caminhos /error/404 e /error/500</h3>
              <p className="text-[11px] text-muted-foreground">Últimos 7 dias · insumo para corrigir links quebrados</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <TrendingUp className="mr-1 h-3 w-3" /> {errorEvents.length} hits
          </Badge>
        </div>

        {topPaths.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum acesso a páginas de erro nos últimos 7 dias.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {topPaths.map((row, i) => (
              <div key={`${row.code}-${row.path}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant={row.code === 500 ? "destructive" : "secondary"} className="shrink-0 text-[10px]">
                    {row.code}
                  </Badge>
                  <span className="truncate font-mono text-[11px] text-foreground">{row.path || "/"}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-bold tabular-nums">{row.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthHealthPanel;
