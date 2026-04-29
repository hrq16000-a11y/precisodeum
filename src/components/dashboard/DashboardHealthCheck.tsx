import { useEffect, useState } from "react";
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
  /** When true, render even if everything is OK (compact green badge). */
  alwaysShow?: boolean;
  /** Called with the latest health result so the parent can decide to block actions. */
  onHealthChange?: (ok: boolean) => void;
}

/**
 * Runs a lightweight DB sanity check on dashboard mount:
 * - critical RPCs exist (register_service_completion, audit_user_ref_health, etc.)
 * - critical columns exist (audit_log.resource_type/details, media.user_ref, ...)
 * If any check fails, surfaces a red alert and reports back so the parent can disable
 * destructive actions until the schema is fixed.
 */
export function DashboardHealthCheck({ alwaysShow = false, onHealthChange }: Props) {
  const [result, setResult] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("validate_db_health" as never);
      if (error) throw error;
      const r = data as unknown as HealthResult;
      setResult(r);
      onHealthChange?.(r.ok);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      onHealthChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
