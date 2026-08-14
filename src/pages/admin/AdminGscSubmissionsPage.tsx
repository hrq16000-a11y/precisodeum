import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,

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
import {
  summarizeAdsenseReports,
  summarizeAdsenseFailuresByRoute,
  type AdsenseRouteReport,
} from "@/lib/seo/adsenseCheck";
import {
  appendAdsenseRun,
  loadAdsenseHistory,
  routeFailureStreak,
  routeOccurrences,
  saveAdsenseHistory,
  type AdsenseCheckRun,
} from "@/lib/seo/adsenseHistory";
import {
  DEFAULT_PERSISTENT_RULES,
  PERSISTENT_RULES_SETTING_KEY,
  adsenseConsecutiveFailures,
  buildPersistentAlertMessage,
  evaluatePersistentAlerts,
  gscConsecutiveFailures,
  parseRules,
  serializeRules,
  type PersistentAlertRule,
  type PersistentAlertSeverity,
} from "@/lib/seo/persistentAlerts";
import {
  buildConsolidatedAudit,
  consolidatedAuditToCsv,
  consolidatedAuditToJson,
} from "@/lib/seo/auditExport";
import { computeGscMetrics } from "@/lib/seo/gscMetrics";
import type { SeoHealthReport } from "@/lib/seo/seoHealth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_FILTERS,
  availablePartitions,
  filterSubmissions,
  paginate,
  partitionKey,
  type SubmissionFilters,
  type SubmissionStatusFilter,
} from "@/lib/seo/gscSubmissionFilters";


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
  const [adsenseHistory, setAdsenseHistory] = useState<AdsenseCheckRun[]>(() => loadAdsenseHistory());
  const [drillRoute, setDrillRoute] = useState<string | null>(null);
  const [rules, setRules] = useState<PersistentAlertRule[]>(DEFAULT_PERSISTENT_RULES);
  const [coverage, setCoverage] = useState<GscCoverageSnapshot[]>([]);
  const [seoReport, setSeoReport] = useState<SeoHealthReport | null>(null);
  const [filters, setFilters] = useState<SubmissionFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);




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
        PERSISTENT_RULES_SETTING_KEY,
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
    setRules(parseRules(map[PERSISTENT_RULES_SETTING_KEY]));
    try {
      const snapshot = map[COVERAGE_SNAPSHOT_KEY] ? JSON.parse(map[COVERAGE_SNAPSHOT_KEY]) : [];
      if (Array.isArray(snapshot)) setCoverage(snapshot as GscCoverageSnapshot[]);
    } catch {
      setCoverage([]);
    }
  }, []);

  /** Último relatório do edge `seo-audit` — usado só no relatório consolidado. */
  const loadSeoReport = useCallback(async () => {
    const { data } = await supabase
      .from("seo_audit_reports")
      .select(
        "id,ran_at,total_urls,ok_count,warning_count,error_count,robots_ok,robots_issues,sitemap_url,findings,duration_ms",
      )
      .order("ran_at", { ascending: false })
      .limit(1);
    setSeoReport(((data ?? [])[0] as unknown as SeoHealthReport) ?? null);
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
    loadSeoReport();
  }, [loadLog, loadSettings, loadProperties, loadSeoReport]);


  const perSitemap = useMemo(() => summarizeBySitemap(rows), [rows]);
  const runs = useMemo(() => groupRuns(rows), [rows]);
  const lastRun = runs[0] ?? null;
  const failures = perSitemap.filter((s) => !s.lastOk);

  const partitions = useMemo(() => availablePartitions(rows), [rows]);
  const filteredRows = useMemo(() => filterSubmissions(rows, filters), [rows, filters]);
  const pageData = useMemo(() => paginate(filteredRows, page, pageSize), [filteredRows, page, pageSize]);
  const patchFilters = (patch: Partial<SubmissionFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };


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
      // A invoke reporta qualquer não-2xx como genérico: leia o corpo real da função.
      let detail: unknown = { error: String(err) };
      const ctx = (err as { context?: Response })?.context;
      if (ctx && typeof ctx.text === "function") {
        try {
          detail = JSON.parse(await ctx.text());
        } catch (_) {
          /* mantém o texto genérico */
        }
      }
      setRunLog({ mode, at: new Date().toISOString(), payload: detail });
      const code = (detail as { error?: string })?.error;
      if (code === "submission_in_progress") {
        toast.error(
          "Já existe um reenvio em andamento. Aguarde a conclusão para evitar submissões duplicadas.",
        );
      } else {
        toast.error(`Falha na execução: ${(detail as { detail?: string })?.detail ?? String(err)}`);
      }
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
    const data = filteredRows.length > 0 ? filteredRows : rows;
    if (data.length === 0) {
      toast.info("Nada para exportar ainda.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      download(submissionsToCsv(data), `gsc-submissoes-${stamp}.csv`, "text/csv;charset=utf-8;");
    } else {
      download(submissionsToJson(data), `gsc-submissoes-${stamp}.json`, "application/json");
    }
    toast.success(`Histórico exportado em ${format.toUpperCase()} (${data.length} linha(s)).`);
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
      setCoverage(current);

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
      const reports = ((data as { reports?: AdsenseRouteReport[] })?.reports ??
        []) as AdsenseRouteReport[];
      setAdsense(reports);
      // Guarda a execução para permitir drill-down histórico por rota.
      const next = appendAdsenseRun(adsenseHistory, {
        at: new Date().toISOString(),
        origin: typeof window !== "undefined" ? window.location.origin : "",
        reports,
      });
      setAdsenseHistory(next);
      saveAdsenseHistory(next);
    } catch (err) {
      toast.error(`Falha ao checar AdSense: ${String(err)}`);
    } finally {
      setAdsenseLoading(false);
    }
  };


  const adsenseSummary = adsense ? summarizeAdsenseReports(adsense) : null;
  const adsenseFailures = useMemo(
    () =>
      adsense
        ? summarizeAdsenseFailuresByRoute(
            adsense,
            typeof window !== "undefined" ? window.location.origin : "",
          )
        : [],
    [adsense],
  );

  /* ── Alertas persistentes (N execuções consecutivas com falha) ── */
  const persistentAlerts = useMemo(() => {
    const gsc = evaluatePersistentAlerts(gscConsecutiveFailures(rows), rules, "gsc");
    const ads = evaluatePersistentAlerts(
      adsenseConsecutiveFailures(adsenseHistory),
      rules,
      "adsense",
    );
    return [...gsc, ...ads];
  }, [rows, rules, adsenseHistory]);

  const patchRule = async (target: PersistentAlertRule["target"], patch: Partial<PersistentAlertRule>) => {
    const next = rules.map((r) => (r.target === target ? { ...r, ...patch } : r));
    setRules(next);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: PERSISTENT_RULES_SETTING_KEY, value: serializeRules(next) }, { onConflict: "key" });
    if (error) toast.error("Falha ao salvar as regras de alerta persistente.");
  };

  const sendPersistentAlerts = async (dryRun: boolean) => {
    if (persistentAlerts.length === 0) {
      toast.info("Nenhuma falha atingiu o limiar configurado.");
      return;
    }
    const property = envProperty[GSC_PROPERTY_SETTING_KEYS[env]] || "—";
    const dashboardUrl = `${window.location.origin}/admin/seo/submissoes`;
    setSendingAlert(true);
    try {
      const { data, error } = await supabase.functions.invoke("gsc-coverage-alert", {
        body: {
          environment: env,
          property,
          dashboardUrl,
          email: persistentAlerts.some((a) => a.email) ? alertEmail || undefined : undefined,
          slack: persistentAlerts.some((a) => a.slack),
          dryRun,
          customMessage: buildPersistentAlertMessage(persistentAlerts, { property, dashboardUrl }),
          alerts: persistentAlerts.map((a) => ({
            sitemap: a.label,
            severity: a.severity,
            metric: "errors" as const,
            before: 0,
            after: a.streak,
            delta: a.streak,
            message: `${a.target === "gsc" ? "Sitemap" : "Rota"} ${a.label} falhou ${a.streak}x seguidas (limiar ${a.threshold}).`,
            suggestion: a.lastError ?? "Verifique a execução mais recente no painel.",
          })),
        },
      });
      if (error) throw error;
      setRunLog({
        mode: dryRun ? "persistent-alert-dry-run" : "persistent-alert",
        at: new Date().toISOString(),
        payload: data,
      });
      toast.success(dryRun ? "Prévia gerada (nada enviado)." : "Alerta persistente enviado.");
    } catch (err) {
      toast.error(`Falha ao enviar alerta persistente: ${String(err)}`);
    } finally {
      setSendingAlert(false);
    }
  };

  /* ── Relatório consolidado da última auditoria ── */
  const exportConsolidated = (format: "json" | "csv") => {
    const audit = buildConsolidatedAudit({
      origin: typeof window !== "undefined" ? window.location.origin : "",
      environment: env,
      property: envProperty[GSC_PROPERTY_SETTING_KEYS[env]] ?? null,
      seoReport,
      adsense,
      submissions: perSitemap,
      coverage,
      metrics: computeGscMetrics(rows, { days: 7 }),
    });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      download(consolidatedAuditToJson(audit), `auditoria-seo-${stamp}.json`, "application/json");
    } else {
      download(consolidatedAuditToCsv(audit), `auditoria-seo-${stamp}.csv`, "text/csv;charset=utf-8;");
    }
    toast.success(`Relatório consolidado exportado em ${format.toUpperCase()}.`);
  };

  const drillOccurrences = useMemo(
    () => (drillRoute ? routeOccurrences(adsenseHistory, drillRoute) : []),
    [drillRoute, adsenseHistory],
  );


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
            <Button variant="secondary" size="sm" onClick={() => exportConsolidated("json")}>
              <Download className="h-4 w-4" aria-hidden /> Relatório consolidado (JSON)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportConsolidated("csv")}>
              <Download className="h-4 w-4" aria-hidden /> Relatório consolidado (CSV)
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

      {/* Log detalhado da última execução manual */}
      {runLog && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Log detalhado — {runLog.mode}</CardTitle>
              <CardDescription>Execução manual em {fmt(runLog.at)}.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRunLog(null)}>
              Limpar
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(runLog.payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Configuração de alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" aria-hidden />
      {/* Alertas persistentes (regras configuráveis) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" aria-hidden />
            Alertas persistentes (GSC + AdSense)
          </CardTitle>
          <CardDescription>
            Só dispara quando a mesma falha se repete por N execuções consecutivas. As regras ficam
            salvas em configurações do site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {rules.map((rule) => (
              <div key={rule.target} className="space-y-3 rounded-md border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {rule.target === "gsc" ? "Search Console" : "AdSense"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`enabled-${rule.target}`} className="text-xs">
                      Ativa
                    </Label>
                    <Switch
                      id={`enabled-${rule.target}`}
                      checked={rule.enabled}
                      onCheckedChange={(v) => patchRule(rule.target, { enabled: v })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Execuções seguidas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={rule.consecutive}
                      onChange={(e) =>
                        patchRule(rule.target, { consecutive: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Severidade</Label>
                    <Select
                      value={rule.severity}
                      onValueChange={(v) =>
                        patchRule(rule.target, { severity: v as PersistentAlertSeverity })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`slack-${rule.target}`}
                      checked={rule.slack}
                      onCheckedChange={(v) => patchRule(rule.target, { slack: v })}
                    />
                    <Label htmlFor={`slack-${rule.target}`} className="text-xs">
                      Slack
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`email-${rule.target}`}
                      checked={rule.email}
                      onCheckedChange={(v) => patchRule(rule.target, { email: v })}
                    />
                    <Label htmlFor={`email-${rule.target}`} className="text-xs">
                      E-mail
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {persistentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma falha atingiu o limiar configurado até agora.
            </p>
          ) : (
            <ul className="space-y-2">
              {persistentAlerts.map((a) => (
                <li
                  key={`${a.target}-${a.key}`}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 p-2 text-sm"
                >
                  <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>
                    {a.severity}
                  </Badge>
                  <span className="font-medium">{a.label}</span>
                  <span className="text-muted-foreground">
                    {a.streak} execuções seguidas com falha (limiar {a.threshold})
                  </span>
                  {a.lastError && (
                    <span className="font-mono text-xs text-destructive">{a.lastError}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    desde {fmt(a.firstFailureAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={sendingAlert || persistentAlerts.length === 0}
              onClick={() => sendPersistentAlerts(true)}
            >
              Pré-visualizar envio
            </Button>
            <Button
              size="sm"
              disabled={sendingAlert || persistentAlerts.length === 0}
              onClick={() => sendPersistentAlerts(false)}
            >
              {sendingAlert ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Enviar agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuração de alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" aria-hidden />
            Alertas de piora de cobertura
          </CardTitle>

          <CardDescription>
            Envia e-mail e/ou Slack com as principais rotas afetadas e links diretos para o
            diagnóstico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="gsc-alert-email" className="text-xs">
                E-mail de destino
              </Label>
              <Input
                id="gsc-alert-email"
                type="email"
                placeholder="seo@precisodeum.com.br"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                onBlur={() => saveSetting(ALERT_EMAIL_KEY, alertEmail)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gravidade mínima</Label>
              <Select
                value={severity}
                onValueChange={(v) => {
                  setSeverity(v as AlertSeverityThreshold);
                  saveSetting(ALERT_SEVERITY_KEY, v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Switch
                id="gsc-alert-slack"
                checked={slackEnabled}
                onCheckedChange={(v) => {
                  setSlackEnabled(v);
                  saveSetting(ALERT_SLACK_KEY, String(v));
                }}
              />
              <Label htmlFor="gsc-alert-slack" className="text-sm">
                Enviar para o Slack
              </Label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendCoverageAlert(true)}
              disabled={sendingAlert}
            >
              {sendingAlert ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FlaskConical className="h-4 w-4" aria-hidden />
              )}
              Pré-visualizar alerta
            </Button>
            <Button size="sm" onClick={() => sendCoverageAlert(false)} disabled={sendingAlert}>
              <Bell className="h-4 w-4" aria-hidden /> Enviar alerta agora
            </Button>
            <span className="text-xs text-muted-foreground">
              {notifiableAlerts.length} alerta(s) no nível “{severity}”.
            </span>
          </div>
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

      {/* Histórico com filtros + paginação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" aria-hidden />
            Histórico de submissões
          </CardTitle>
          <CardDescription>
            Busque por sitemap, partição, status e período. A exportação respeita os filtros ativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              placeholder="Buscar sitemap ou erro…"
              value={filters.query}
              onChange={(e) => patchFilters({ query: e.target.value })}
              aria-label="Buscar no histórico de submissões"
            />
            <Select
              value={filters.partition}
              onValueChange={(v) => patchFilters({ partition: v })}
            >
              <SelectTrigger aria-label="Filtrar por partição">
                <SelectValue placeholder="Partição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as partições</SelectItem>
                {partitions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(v) => patchFilters({ status: v as SubmissionStatusFilter })}
            >
              <SelectTrigger aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ok">Somente sucesso</SelectItem>
                <SelectItem value="failed">Somente falhas</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => patchFilters({ from: e.target.value || undefined })}
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => patchFilters({ to: e.target.value || undefined })}
              aria-label="Data final"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {pageData.totalItems} registro(s) · página {pageData.page} de {pageData.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[110px]" aria-label="Itens por página">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : pageData.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum registro para os filtros selecionados.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Data</th>
                    <th>Partição</th>
                    <th>Status</th>
                    <th>Sitemap</th>
                    <th>Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="whitespace-nowrap py-2 pr-3">{fmt(r.created_at)}</td>
                      <td className="pr-3">{partitionKey(r.sitemap ?? "")}</td>
                      <td>
                        <Badge variant={r.ok ? "secondary" : "destructive"}>
                          {r.ok ? "OK" : (r.status ?? "erro")}
                        </Badge>
                      </td>
                      <td className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {r.sitemap}
                      </td>
                      <td className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {r.error ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pageData.hasPrev}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pageData.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Falhas de AdSense por rota */}
      {adsenseFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              Falhas do AdSense por rota
            </CardTitle>
            <CardDescription>
              Códigos de erro detectados na verificação, com o que fazer e links diretos de
              diagnóstico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {adsenseFailures.map((f) => (
              <div key={f.route} className="rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.route}</span>
                    <Badge variant={f.level === "error" ? "destructive" : "secondary"}>
                      HTTP {f.httpStatus ?? "—"}
                    </Badge>
                    {[...f.errorCodes, ...f.warningCodes].map((code) => (
                      <Badge key={code} variant="outline" className="font-mono text-[10px]">
                        {code}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      className="text-xs underline underline-offset-2"
                      href={f.routeUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir rota
                    </a>
                    <a
                      className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                      href={f.diagnosticUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Diagnóstico <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {f.issues.map((i, idx) => (
                    <li
                      key={`${f.route}-${i.code}-${idx}`}
                      className={i.level === "error" ? "text-destructive" : "text-muted-foreground"}
                    >
                      • <span className="font-mono">{i.code}</span> — {i.message}{" "}
                      <span className="text-muted-foreground">{i.hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}


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
