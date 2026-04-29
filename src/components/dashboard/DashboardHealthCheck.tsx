import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";

type HealthResult = {
  ok: boolean;
  checked_at: string;
  rpcs: { name: string; ok: boolean }[];
  columns: { table: string; column: string; ok: boolean }[];
};

interface Props {
  alwaysShow?: boolean;
  onHealthChange?: (ok: boolean) => void;
  /** Background re-run interval in ms. Default: 5 minutes. Set 0 to disable. */
  intervalMs?: number;
}

const STORAGE_LAST_LOG = "health_check_last_logged_at";
const LOG_THROTTLE_MS = 10 * 60 * 1000; // log to DB at most every 10 min per tab

/**
 * Runs validate_db_health on mount, then periodically (every 5 min by default).
 * Records each result into health_check_history (throttled to avoid spam).
 * Surfaces a red alert if any RPC/column is missing.
 */
export function DashboardHealthCheck({
  alwaysShow = false,
  onHealthChange,
  intervalMs = 5 * 60 * 1000,
}: Props) {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastLoggedRef = useRef<number>(0);

  const persistResult = async (r: HealthResult) => {
    try {
      const now = Date.now();
      const last = lastLoggedRef.current ||
        Number(sessionStorage.getItem(STORAGE_LAST_LOG) ?? 0);
      // Always log when status changes, otherwise throttle
      const shouldLog = r.ok === false || (now - last) > LOG_THROTTLE_MS;
      if (!shouldLog) return;
      lastLoggedRef.current = now;
      sessionStorage.setItem(STORAGE_LAST_LOG, String(now));
      const { data: { user } } = await supabase.auth.getUser();
      const failedRpcs = r.rpcs.filter((x) => !x.ok).map((x) => x.name);
      const failedColumns = r.columns.filter((x) => !x.ok)
        .map((x) => ({ table: x.table, column: x.column }));
      await supabase.from("health_check_history" as never).insert({
        user_id: user?.id ?? null,
        source: "dashboard",
        ok: r.ok,
        failed_rpcs: failedRpcs,
        failed_columns: failedColumns,
        raw: r as unknown as Record<string, unknown>,
      } as never);
    } catch (e) {
      // Silent — health logging must never break the dashboard
      console.warn("[DashboardHealthCheck] persist failed:", e);
    }
  };

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("validate_db_health" as never);
      if (error) throw error;
      const r = data as unknown as HealthResult;
      setResult(r);
      onHealthChange?.(r.ok);
      void persistResult(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      onHealthChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void run();
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => void run(), intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  if (loading && !result) {
    return (
      <Alert className="mb-3">
        <Loader2 className="size-4 animate-spin" />
        <AlertTitle>Verificando integridade do banco...</AlertTitle>
      </Alert>
    );
  }

  if (err) {
    return (
      <Alert variant="destructive" className="mb-3">
        <AlertTriangle className="size-4" />
        <AlertTitle>Não foi possível validar a saúde do banco</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-xs">{err}</p>
          <Button size="sm" variant="outline" onClick={run}>
            <RefreshCw className="size-3 mr-1" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!result) return null;

  if (result.ok) {
    if (!alwaysShow) return null;
    return (
      <Alert className="mb-3 border-green-500/40">
        <CheckCircle2 className="size-4 text-green-600" />
        <AlertTitle className="text-sm">
          Banco íntegro — RPCs e colunas críticas OK
        </AlertTitle>
      </Alert>
    );
  }

  const badRpcs = result.rpcs.filter((r) => !r.ok);
  const badCols = result.columns.filter((c) => !c.ok);

  return (
    <Alert variant="destructive" className="mb-3">
      <AlertTriangle className="size-4" />
      <AlertTitle>Inconsistência detectada — algumas ações estão bloqueadas</AlertTitle>
      <AlertDescription className="space-y-2">
        {badRpcs.length > 0 && (
          <div className="text-xs">
            <strong>RPCs ausentes:</strong>{" "}
            {badRpcs.map((r) => r.name).join(", ")}
          </div>
        )}
        {badCols.length > 0 && (
          <div className="text-xs">
            <strong>Colunas ausentes:</strong>{" "}
            {badCols.map((c) => `${c.table}.${c.column}`).join(", ")}
          </div>
        )}
        <p className="text-[11px] opacity-80">
          Rode a última migração ou contate o administrador antes de prosseguir.
        </p>
        <Button size="sm" variant="outline" onClick={run}>
          <RefreshCw className="size-3 mr-1" /> Revalidar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
