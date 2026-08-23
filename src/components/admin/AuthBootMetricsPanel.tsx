import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, Lock, ShieldCheck, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BootRow {
  duration_ms: number;
  succeeded: boolean;
  outcome: string | null;
  lock_broken_count: number | null;
  environment: string | null;
  recorded_at: string;
  user_id: string | null;
}

const RANGES: Record<string, number> = {
  "1h": 1,
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

const ENVS = ["all", "production", "preview", "development", "unknown"] as const;
type EnvFilter = (typeof ENVS)[number];

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const AuthBootMetricsPanel = () => {
  const [range, setRange] = useState<keyof typeof RANGES>("24h");
  const [env, setEnv] = useState<EnvFilter>("all");

  const since = useMemo(
    () => new Date(Date.now() - RANGES[range] * 60 * 60 * 1000).toISOString(),
    [range]
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["auth-boot-metrics", range, env],
    queryFn: async () => {
      let q: any = (supabase.from("auth_profile_metrics" as any) as any)
        .select("duration_ms, succeeded, outcome, lock_broken_count, environment, recorded_at, user_id")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(5000);
      if (env !== "all") q = q.eq("environment", env);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as BootRow[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const stats = useMemo(() => {
    const durations = rows.map((r) => r.duration_ms).sort((a, b) => a - b);
    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const p99 = percentile(durations, 99);
    const total = rows.length;
    const watchdog = rows.filter((r) => r.outcome === "watchdog_forced").length;
    const resolved = rows.filter((r) => r.outcome === "resolved").length;
    const noSession = rows.filter((r) => r.outcome === "no_session").length;
    const lockBroken = rows.reduce((acc, r) => acc + (r.lock_broken_count || 0), 0);
    const lockSessions = rows.filter((r) => (r.lock_broken_count || 0) > 0).length;
    return { p50, p95, p99, total, watchdog, resolved, noSession, lockBroken, lockSessions };
  }, [rows]);

  const watchdogRate = stats.total > 0 ? Math.round((stats.watchdog / stats.total) * 100) : 0;
  const alert = watchdogRate > 2 || stats.p95 > 4000;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${alert ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
            <Activity className={`h-5 w-5 ${alert ? "text-red-600" : "text-emerald-600"}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Boot do Auth (loading=false)</h3>
            <p className="text-[11px] text-muted-foreground">
              Tempo até o hook resolver, watchdog forçado e contagem de “Lock broken” (navigatorLock).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            className="rounded-lg border border-border/60 bg-background px-2 py-1 text-[11px]"
            value={range}
            onChange={(e) => setRange(e.target.value as keyof typeof RANGES)}
            aria-label="Janela de tempo"
          >
            {Object.keys(RANGES).map((k) => (
              <option key={k} value={k}>Últimas {k}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-border/60 bg-background px-2 py-1 text-[11px]"
            value={env}
            onChange={(e) => setEnv(e.target.value as EnvFilter)}
            aria-label="Ambiente"
          >
            {ENVS.map((e) => (
              <option key={e} value={e}>{e === "all" ? "Todos ambientes" : e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-border/40 bg-background/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Amostras</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{isLoading ? "…" : stats.total}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-background/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">p50 / p95 / p99</p>
          <p className="mt-1 text-base font-bold tabular-nums text-foreground">
            {stats.p50}<span className="text-muted-foreground"> / </span>
            <span className={stats.p95 > 4000 ? "text-amber-600" : ""}>{stats.p95}</span>
            <span className="text-muted-foreground"> / </span>
            <span className={stats.p99 > 8000 ? "text-red-600" : ""}>{stats.p99}</span>
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">ms</span>
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-background/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Watchdog forçado</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${watchdogRate > 2 ? "text-red-600" : "text-foreground"}`}>
            {stats.watchdog} <span className="text-[11px] font-normal text-muted-foreground">({watchdogRate}%)</span>
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-background/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Lock broken</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${stats.lockSessions > 0 ? "text-amber-600" : "text-foreground"}`}>
            {stats.lockBroken}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">em {stats.lockSessions} sessão(ões)</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="h-3 w-3" /> resolved: {stats.resolved}
        </Badge>
        <Badge variant="outline" className="gap-1">
          no_session: {stats.noSession}
        </Badge>
        <Badge variant={stats.watchdog > 0 ? "destructive" : "outline"} className="gap-1">
          <AlertTriangle className="h-3 w-3" /> watchdog_forced: {stats.watchdog}
        </Badge>
        <Badge variant={stats.lockBroken > 0 ? "secondary" : "outline"} className="gap-1">
          <Lock className="h-3 w-3" /> lock_broken: {stats.lockBroken}
        </Badge>
      </div>

      {alert && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-semibold">Sinal de degradação detectado.</p>
            <p className="mt-0.5 opacity-90">
              {watchdogRate > 2 && <>Taxa de watchdog acima de 2% ({watchdogRate}%). </>}
              {stats.p95 > 4000 && <>p95 acima de 4s ({stats.p95}ms). </>}
              Investigar bloqueios de navigatorLock e latência do Supabase.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthBootMetricsPanel;
