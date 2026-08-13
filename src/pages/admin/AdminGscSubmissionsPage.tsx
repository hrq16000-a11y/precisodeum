import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  FlaskConical,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Megaphone,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  diffCoverage,
  groupRuns,
  sitemapGroup,
  summarizeBySitemap,
  GSC_PROPERTY_SETTING_KEYS,
  environmentFromHost,
  type CoverageAlert,
  type GscAuditRow,
  type GscCoverageSnapshot,
  type GscEnvironment,
} from "@/lib/seo/gscSubmissions";
import {
  filterBySeverity,
  submissionsToCsv,
  submissionsToJson,
  type AlertSeverityThreshold,
} from "@/lib/seo/gscAlerts";
import { summarizeAdsenseReports, type AdsenseRouteReport } from "@/lib/seo/adsenseCheck";

const COVERAGE_SNAPSHOT_KEY = "gsc_coverage_snapshot";
const ALERT_EMAIL_KEY = "gsc_alert_email";
const ALERT_SLACK_KEY = "gsc_alert_slack_enabled";
const ALERT_SEVERITY_KEY = "gsc_alert_severity";
const ENVIRONMENTS: GscEnvironment[] = ["prod", "staging", "dev"];
const SEVERITIES: AlertSeverityThreshold[] = ["critical", "warning", "info"];

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const download = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminGscSubmissionsPage = () => {
  const [rows, setRows] = useState<GscAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<null | "validate" | "submit" | "dryRun">(null);
  const [runLog, setRunLog] = useState<{ mode: string; at: string; payload: unknown } | null>(null);
  const [properties, setProperties] = useState<string[]>([]);
  const [env, setEnv] = useState<GscEnvironment>(() =>
    environmentFromHost(typeof window !== "undefined" ? window.location.hostname : ""),
  );
  const [envProperty, setEnvProperty] = useState<Record<string, string>>({});
  const [alerts, setAlerts] = useState<CoverageAlert[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [severity, setSeverity] = useState<AlertSeverityThreshold>("warning");
  const [sendingAlert, setSendingAlert] = useState(false);
  const [adsense, setAdsense] = useState<AdsenseRouteReport[] | null>(null);
  const [adsenseLoading, setAdsenseLoading] = useState(false);


  const loadLog = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gsc_audit_log")
      .select("id, action, site, sitemap, status, ok, error, created_at")
      .eq("action", "submit-sitemap")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("Não foi possível ler o histórico de submissões.");
    setRows((data as GscAuditRow[]) ?? []);
    setLoading(false);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        ...Object.values(GSC_PROPERTY_SETTING_KEYS),
        COVERAGE_SNAPSHOT_KEY,
        ALERT_EMAIL_KEY,
        ALERT_SLACK_KEY,
        ALERT_SEVERITY_KEY,
      ]);
    const map: Record<string, string> = {};
    for (const r of data ?? []) {
      const v = (r as { key: string; value: unknown }).value;
      map[(r as { key: string }).key] = typeof v === "string" ? v : JSON.stringify(v);
    }
    setEnvProperty(map);
    if (map[ALERT_EMAIL_KEY]) setAlertEmail(map[ALERT_EMAIL_KEY]);
    if (map[ALERT_SLACK_KEY]) setSlackEnabled(map[ALERT_SLACK_KEY] !== "false");
    if (SEVERITIES.includes(map[ALERT_SEVERITY_KEY] as AlertSeverityThreshold)) {
      setSeverity(map[ALERT_SEVERITY_KEY] as AlertSeverityThreshold);
    }
  }, []);


  const loadProperties = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("gsc-verify?action=list", {
        method: "GET",
      });
      const list = ((data as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> })
        ?.siteEntry ?? [])
        .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
        .map((s) => s.siteUrl);
      setProperties(list);
    } catch (_) {
      setProperties([]);
    }
  }, []);

  useEffect(() => {
    loadLog();
    loadSettings();
    loadProperties();
  }, [loadLog, loadSettings, loadProperties]);

  const perSitemap = useMemo(() => summarizeBySitemap(rows), [rows]);
  const runs = useMemo(() => groupRuns(rows), [rows]);
  const lastRun = runs[0] ?? null;
  const failures = perSitemap.filter((s) => !s.lastOk);

  const saveEnvProperty = async (value: string) => {
    const key = GSC_PROPERTY_SETTING_KEYS[env];
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) {
      toast.error("Falha ao salvar a propriedade do ambiente.");
      return;
    }
    setEnvProperty((prev) => ({ ...prev, [key]: value }));
    toast.success(`Propriedade de ${env} salva.`);
  };

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) {
      toast.error("Falha ao salvar a configuração de alertas.");
      return;
    }
    setEnvProperty((prev) => ({ ...prev, [key]: value }));
    toast.success("Configuração de alertas salva.");
  };

  const runSubmission = async (mode: "validate" | "submit" | "dryRun") => {
    setRunning(mode);
    try {
      const { data, error } = await supabase.functions.invoke("gsc-submit-sitemaps", {
        body: {
          environment: env,
          property: envProperty[GSC_PROPERTY_SETTING_KEYS[env]] || undefined,
          validateOnly: mode === "validate",
          dryRun: mode === "dryRun",
        },
      });
      if (error) throw error;
      const res = data as Record<string, unknown>;
      setRunLog({ mode, at: new Date().toISOString(), payload: res });
      if (mode === "validate") {
        toast.success(`Validação: ${res.valid} ok · ${res.invalid} com problema.`);
      } else if (mode === "dryRun") {
        toast.success(
          `Dry-run: ${res.total} sitemap(s) seriam enviados a ${res.property} (${res.skipped} pulados).`,
        );
      } else if (res.error) {
        toast.error(String(res.error));
      } else {
        toast.success(
          `Submetidos ${res.succeeded}/${res.submitted} sitemaps (${res.failed} falhas).`,
        );
      }
      if (mode !== "dryRun") {
        await loadLog();
        await refreshCoverage();
      }
    } catch (err) {
      setRunLog({ mode, at: new Date().toISOString(), payload: { error: String(err) } });
      toast.error(`Falha na execução: ${String(err)}`);
    } finally {
      setRunning(null);
    }
  };

  const notifiableAlerts = useMemo(() => filterBySeverity(alerts, severity), [alerts, severity]);

  const sendCoverageAlert = async (dryRun: boolean) => {
    if (notifiableAlerts.length === 0) {
      toast.info("Nenhum alerta no nível de gravidade selecionado.");
      return;
    }
    setSendingAlert(true);
    try {
      const { data, error } = await supabase.functions.invoke("gsc-coverage-alert", {
        body: {
          alerts: notifiableAlerts,
          environment: env,
          property: envProperty[GSC_PROPERTY_SETTING_KEYS[env]] || undefined,
          dashboardUrl: `${window.location.origin}/admin/seo?tab=submissoes`,
          email: alertEmail || undefined,
          slack: slackEnabled,
          dryRun,
        },
      });
      if (error) throw error;
      setRunLog({ mode: dryRun ? "alert-dry-run" : "alert", at: new Date().toISOString(), payload: data });
      const res = data as { channels?: Array<{ channel: string; ok: boolean }> };
      if (dryRun) toast.success("Prévia do alerta gerada (nada foi enviado).");
      else if (res.channels?.some((c) => c.ok)) toast.success("Alerta de cobertura enviado.");
      else toast.error("Nenhum canal de alerta pôde enviar. Veja o log detalhado.");
    } catch (err) {
      toast.error(`Falha ao enviar alerta: ${String(err)}`);
    } finally {
      setSendingAlert(false);
    }
  };

  const exportHistory = (format: "csv" | "json") => {
    if (rows.length === 0) {
      toast.info("Nada para exportar ainda.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      download(submissionsToCsv(rows), `gsc-submissoes-${stamp}.csv`, "text/csv;charset=utf-8;");
    } else {
      download(submissionsToJson(rows), `gsc-submissoes-${stamp}.json`, "application/json");
    }
    toast.success(`Histórico exportado em ${format.toUpperCase()}.`);
  };


  /** Lê cobertura atual no GSC, compara com o snapshot anterior e persiste o novo. */
  const refreshCoverage = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("gsc-verify?action=list-sitemaps", {
        method: "GET",
      });
      const entries = (data as { sitemap?: Array<Record<string, unknown>> })?.sitemap ?? [];
      const current: GscCoverageSnapshot[] = entries.map((e) => {
        const contents = (e.contents as Array<{ submitted?: string; indexed?: string }>) ?? [];
        const sum = (field: "submitted" | "indexed") =>
          contents.reduce((acc, c) => acc + Number(c[field] ?? 0), 0);
        return {
          sitemap: String(e.path ?? ""),
          submitted: sum("submitted"),
          indexed: sum("indexed"),
          errors: Number(e.errors ?? 0),
          warnings: Number(e.warnings ?? 0),
        };
      });

      let previous: GscCoverageSnapshot[] = [];
      try {
        const raw = envProperty[COVERAGE_SNAPSHOT_KEY];
        previous = raw ? JSON.parse(raw) : [];
      } catch (_) {
        previous = [];
      }
      setAlerts(diffCoverage(previous, current));

      await supabase
        .from("site_settings")
        .upsert(
          { key: COVERAGE_SNAPSHOT_KEY, value: JSON.stringify(current) },
          { onConflict: "key" },
        );
    } catch (_) {
      // cobertura indisponível não bloqueia o painel
    }
  }, [envProperty]);

  const runAdsenseCheck = async () => {
    setAdsenseLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seo-adsense-check", { body: {} });
      if (error) throw error;
      setAdsense(((data as { reports?: AdsenseRouteReport[] })?.reports ?? []) as AdsenseRouteReport[]);
    } catch (err) {
      toast.error(`Falha ao checar AdSense: ${String(err)}`);
    } finally {
      setAdsenseLoading(false);
    }
  };

  const adsenseSummary = adsense ? summarizeAdsenseReports(adsense) : null;

  return (
    <div className="space-y-4 motion-enter">
      {/* Ações + ambiente */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              Submissões no Search Console
            </CardTitle>
            <CardDescription>
              Último envio, resultado por sitemap particionado e falhas — baseado em{" "}
              <code>gsc_audit_log</code>.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={env} onValueChange={(v) => setEnv(v as GscEnvironment)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENVIRONMENTS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={envProperty[GSC_PROPERTY_SETTING_KEYS[env]] ?? ""}
              onValueChange={saveEnvProperty}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Propriedade verificada…" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadLog} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSubmission("validate")}
              disabled={running !== null}
            >
              {running === "validate" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              )}
              Validar partições
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runSubmission("dryRun")}
              disabled={running !== null}
            >
              {running === "dryRun" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FlaskConical className="h-4 w-4" aria-hidden />
              )}
              Reenviar (dry-run)
            </Button>
            <Button size="sm" onClick={() => runSubmission("submit")} disabled={running !== null}>
              {running === "submit" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Reenviar sitemaps do último build
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportHistory("csv")}>
              <Download className="h-4 w-4" aria-hidden /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportHistory("json")}>
              <Download className="h-4 w-4" aria-hidden /> JSON
            </Button>

          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <Kpi label="Último envio" value={fmt(lastRun?.finishedAt)} />
              <Kpi label="Sitemaps na última rodada" value={String(lastRun?.total ?? 0)} />
              <Kpi
                label="Sucesso"
                value={`${lastRun?.succeeded ?? 0}/${lastRun?.total ?? 0}`}
                tone={lastRun && lastRun.failed > 0 ? "warn" : "ok"}
              />
              <Kpi
                label="Falhas ativas"
                value={String(failures.length)}
                tone={failures.length > 0 ? "bad" : "ok"}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas de cobertura */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              Cobertura piorou desde a última build
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.slice(0, 10).map((a, i) => (
              <Alert key={`${a.sitemap}-${a.metric}-${i}`} variant={a.severity === "critical" ? "destructive" : "default"}>
                <AlertTitle className="text-sm">
                  {sitemapGroup(a.sitemap)} · {a.message}
                </AlertTitle>
                <AlertDescription className="text-xs">{a.suggestion}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resultado por sitemap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado por sitemap</CardTitle>
          <CardDescription>Falhas aparecem primeiro. Tentativas somam todo o histórico.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : perSitemap.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma submissão registrada ainda. Use “Submeter agora” ou aguarde o job pós-build.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Partição</th>
                  <th>Status</th>
                  <th>Último envio</th>
                  <th>Tentativas</th>
                  <th>Taxa de sucesso</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {perSitemap.map((s) => (
                  <tr key={s.sitemap} className="border-t border-border/60">
                    <td className="py-2 pr-3 font-medium">{sitemapGroup(s.sitemap)}</td>
                    <td>
                      {s.lastOk ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden /> OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" aria-hidden /> {s.lastStatus ?? "erro"}
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{fmt(s.lastAt)}</td>
                    <td>{s.attempts}</td>
                    <td>{Math.round(s.successRate * 100)}%</td>
                    <td className="max-w-[280px] truncate text-xs text-muted-foreground">
                      {s.lastError ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* AdSense */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" aria-hidden />
              Status do AdSense por rota
            </CardTitle>
            <CardDescription>
              Confere meta <code>google-adsense-account</code>, script <code>adsbygoogle.js</code> e blocos{" "}
              <code>&lt;ins&gt;</code>.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={runAdsenseCheck} disabled={adsenseLoading}>
            {adsenseLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Verificar rotas
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {adsenseLoading && <Skeleton className="h-32 w-full" />}
          {!adsenseLoading && adsenseSummary && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label="Rotas checadas" value={String(adsenseSummary.total)} />
              <Kpi
                label="Com erro"
                value={String(adsenseSummary.errorCount)}
                tone={adsenseSummary.errorCount > 0 ? "bad" : "ok"}
              />
              <Kpi
                label="Com aviso"
                value={String(adsenseSummary.warningCount)}
                tone={adsenseSummary.warningCount > 0 ? "warn" : "ok"}
              />
            </div>
          )}
          {!adsenseLoading &&
            adsense?.map((r) => (
              <div key={r.route} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.route}</span>
                  <Badge variant={r.ok ? "secondary" : "destructive"}>
                    HTTP {r.httpStatus ?? "—"}
                  </Badge>
                </div>
                {r.issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Sem problemas detectados.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs">
                    {r.issues.map((i, idx) => (
                      <li
                        key={`${r.route}-${i.code}-${idx}`}
                        className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}
                      >
                        • {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          {!adsenseLoading && !adsense && (
            <p className="text-sm text-muted-foreground">
              Rode a verificação para listar erros de carregamento e meta tags por rota.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Kpi = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) => (
  <div className="rounded-md border border-border/60 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p
      className={`text-lg font-semibold ${
        tone === "bad" ? "text-destructive" : tone === "warn" ? "text-amber-600" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

export default AdminGscSubmissionsPage;
