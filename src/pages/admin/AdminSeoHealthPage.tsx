/**
 * AdminSeoHealthPage — Painel único de saúde SEO.
 *
 * Une, sem duplicar lógica:
 *   • último relatório do edge `seo-audit` (tabela `seo_audit_reports`);
 *   • cobertura do Google Search Console (`gsc-verify?action=list-sitemaps`);
 *   • agregações puras de `src/lib/seo/seoHealth.ts`.
 *
 * Fail-closed: quando o GSC não responde, o painel mostra "cobertura
 * desconhecida" — nunca assume zero nem verde.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Download, FileWarning, Gauge, Info,
  Link2Off, RefreshCcw, Search, ShieldCheck, TrendingDown, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AsyncBoundary, SkeletonCardGrid } from '@/components/motion';
import GscThresholdAlertsCard from '@/components/admin/GscThresholdAlertsCard';
import { useSeoHead } from '@/hooks/useSeoHead';
import {
  buildHistory, buildRouteAlerts, buildRouteDrilldown, computeSeoHealthScore, crossReferenceSeo,
  diffRouteBetweenReports, healthBand, routeHistoryToCsv, summarizeGscCoverage, summarizeIndexation,
  type CrossFinding, type GscCoverage, type GscSitemapEntry, type RouteGroup, type SeoHealthReport,
} from '@/lib/seo/seoHealth';
import {
  CONSISTENCY_LABEL, consistencyIssuesToCsv, validateSitemapConsistency,
  type SitemapEntry,
} from '@/lib/seo/sitemapConsistency';

/** Download client-side de um CSV gerado em memória (sem backend). */
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DeltaPill = ({ value, invert = false }: { value: number; invert?: boolean }) => {
  if (value === 0) return <span className="text-muted-foreground">estável</span>;
  const bad = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 ${bad ? 'text-destructive' : 'text-emerald-600'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {value > 0 ? `+${value}` : value}
    </span>
  );
};

const BAND_LABEL: Record<ReturnType<typeof healthBand>, string> = {
  unknown: 'Sem dados',
  critical: 'Crítico',
  attention: 'Atenção',
  good: 'Bom',
  excellent: 'Excelente',
};

const BAND_CLASS: Record<ReturnType<typeof healthBand>, string> = {
  unknown: 'bg-muted text-muted-foreground',
  critical: 'bg-destructive/10 text-destructive',
  attention: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  good: 'bg-primary/10 text-primary',
  excellent: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

const SEVERITY_ICON: Record<CrossFinding['severity'], typeof Info> = {
  ok: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  critical: FileWarning,
};

const SEVERITY_CLASS: Record<CrossFinding['severity'], string> = {
  ok: 'border-emerald-500/40 bg-emerald-500/5',
  info: 'border-border bg-muted/30',
  warning: 'border-amber-500/40 bg-amber-500/5',
  critical: 'border-destructive/40 bg-destructive/5',
};

const Metric = ({
  label, value, hint, icon: Icon,
}: { label: string; value: string; hint?: string; icon: typeof Gauge }) => (
  <Card className="p-4 transition-shadow duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </div>
    <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </Card>
);

export default function AdminSeoHealthPage() {
  useSeoHead({
    title: 'Saúde SEO — Admin',
    description: 'Painel de saúde SEO: sitemap, robots, indexáveis vs noindex e cobertura do Search Console.',
    noindex: true,
  });

  const [reports, setReports] = useState<SeoHealthReport[]>([]);
  const [gscRows, setGscRows] = useState<GscSitemapEntry[] | null>(null);
  const [gscUnavailable, setGscUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await (supabase as any)
      .from('seo_audit_reports')
      .select('id,ran_at,total_urls,ok_count,warning_count,error_count,robots_ok,robots_issues,sitemap_url,findings,duration_ms')
      .order('ran_at', { ascending: false })
      .limit(20);
    if (err) setError(err);
    else setReports((data as SeoHealthReport[]) ?? []);

    // Cobertura do GSC é opcional: falha vira "desconhecido", não erro de tela.
    try {
      const params = new URLSearchParams({ action: 'list-sitemaps', site: 'https://www.precisodeum.com.br/' });
      const { data: gsc, error: gscErr } = await supabase.functions.invoke(
        `gsc-verify?${params.toString()}`, { method: 'GET' },
      );
      if (gscErr) throw gscErr;
      const rows = ((gsc as any)?.sitemap as GscSitemapEntry[]) ?? [];
      setGscRows(rows);
      setGscUnavailable(false);
    } catch {
      setGscRows(null);
      setGscUnavailable(true);
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const latest = reports[0] ?? null;
  const summary = useMemo(() => summarizeIndexation(latest), [latest]);
  const coverage: GscCoverage | null = useMemo(
    () => (gscRows ? summarizeGscCoverage(gscRows) : null),
    [gscRows],
  );
  const alerts = useMemo(() => buildRouteAlerts(latest), [latest]);
  const history = useMemo(() => buildHistory(reports).slice(-10).reverse(), [reports]);
  const findings = useMemo(
    () => crossReferenceSeo(summary, coverage, {
      robotsOk: latest?.robots_ok,
      sitemapUrl: latest?.sitemap_url ?? null,
    }),
    [summary, coverage, latest],
  );
  const score = useMemo(
    () => computeSeoHealthScore(summary, coverage, !!latest?.robots_ok),
    [summary, coverage, latest],
  );
  const band = healthBand(score);

  // ── Drill-down por rota ────────────────────────────────────────────────
  const [openRoute, setOpenRoute] = useState<RouteGroup | null>(null);
  const previous = reports[1] ?? null;
  const drilldown = useMemo(
    () => (openRoute ? buildRouteDrilldown(latest, openRoute) : null),
    [latest, openRoute],
  );
  const routeDiff = useMemo(
    () => (openRoute ? diffRouteBetweenReports(latest, previous, openRoute) : null),
    [latest, previous, openRoute],
  );

  // ── Consistência do sitemap particionado (canônicos + noindex) ─────────
  const consistency = useMemo(() => {
    const entries: SitemapEntry[] = (latest?.findings ?? []).map((f) => ({
      loc: f.url,
      partition: f.source_sitemap ?? latest?.sitemap_url ?? 'sitemap.xml',
    }));
    return validateSitemapConsistency(entries, latest?.findings ?? []);
  }, [latest]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6" aria-hidden /> Saúde SEO
          </h1>
          <p className="text-sm text-muted-foreground">
            Sitemap, robots, indexáveis vs noindex, alertas por rota e cobertura do Search Console — em um só lugar.
          </p>
        </div>
        <Button onClick={refresh} disabled={refreshing} variant="outline" className="gap-2 transition-transform active:scale-[.98]">
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          Atualizar
        </Button>
      </header>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && reports.length === 0}
        skeleton={<SkeletonCardGrid count={6} />}
        emptyTitle="Nenhuma auditoria registrada"
        emptyDescription="Rode a auditoria na aba Sitemap para popular este painel."
        onRetry={refresh}
      >
        <div className="space-y-6">
          {/* Score + KPIs */}
          <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))] motion-stagger">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Gauge className="h-4 w-4" aria-hidden /> Score de saúde
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{score ?? '—'}</span>
                <Badge className={BAND_CLASS[band]}>{BAND_LABEL[band]}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Heurística local + Search Console. Sem auditoria, fica indefinido.
              </p>
            </Card>
            <Metric icon={CheckCircle2} label="Indexáveis (amostra)" value={String(summary.indexable)}
              hint={`${summary.indexableRatio}% de ${summary.audited} URLs auditadas`} />
            <Metric icon={ShieldCheck} label="Noindex" value={String(summary.noindex)}
              hint="Devem ficar fora do sitemap" />
            <Metric icon={Link2Off} label="Quebradas" value={String(summary.broken)}
              hint="HTTP >= 400 ou erro de fetch" />
            <Metric icon={FileWarning} label="Canônico divergente" value={String(summary.canonicalMismatch)}
              hint="Provável duplicata indexável" />
            <Metric
              icon={Activity}
              label="Cobertura GSC"
              value={coverage?.indexedRatio != null ? `${coverage.indexedRatio}%` : '—'}
              hint={
                gscUnavailable
                  ? 'Search Console indisponível'
                  : coverage
                    ? `${coverage.indexed} indexadas de ${coverage.submitted} enviadas`
                    : 'Sem dados'
              }
            />
          </section>

          {/* robots / sitemap */}
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <Badge variant={latest?.robots_ok ? 'outline' : 'destructive'}>
              robots.txt {latest?.robots_ok ? 'ok' : 'com problema'}
            </Badge>
            <Badge variant="outline" className="max-w-full truncate">
              sitemap: {latest?.sitemap_url ?? 'não registrado'}
            </Badge>
            {coverage && (
              <>
                <Badge variant="outline">{coverage.sitemaps} sitemap(s) no GSC</Badge>
                {coverage.pending > 0 && <Badge variant="secondary">{coverage.pending} pendente(s)</Badge>}
                {coverage.errors > 0 && <Badge variant="destructive">{coverage.errors} erro(s) GSC</Badge>}
              </>
            )}
            {latest && (
              <span className="ml-auto text-xs text-muted-foreground">
                Última auditoria: {new Date(latest.ran_at).toLocaleString('pt-BR')}
              </span>
            )}
          </Card>

          <GscThresholdAlertsCard
            sample={{
              indexedRatio: coverage?.indexedRatio ?? null,
              sitemapErrors: coverage?.errors ?? null,
            }}
          />

          {/* Alertas cruzados */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Alertas cruzados (local × Search Console)</h2>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))] motion-stagger">
              {findings.map((f) => {
                const Icon = SEVERITY_ICON[f.severity];
                return (
                  <div key={f.id} className={`rounded-lg border p-3 ${SEVERITY_CLASS[f.severity]}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <div>
                        <p className="text-sm font-medium">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Alertas por rota */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Principais alertas por rota</h2>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum finding na última auditoria.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Rota</th>
                      <th className="p-2">URLs</th>
                      <th className="p-2">Erros</th>
                      <th className="p-2">Avisos</th>
                      <th className="p-2">Noindex</th>
                      <th className="p-2">Problemas mais comuns</th>
                      <th className="p-2 sr-only">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.route} className="border-t transition-colors hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">{a.route}</td>
                        <td className="p-2 tabular-nums">{a.total}</td>
                        <td className="p-2 tabular-nums text-destructive">{a.errors || '—'}</td>
                        <td className="p-2 tabular-nums text-amber-700 dark:text-amber-400">{a.warnings || '—'}</td>
                        <td className="p-2 tabular-nums">{a.noindex || '—'}</td>
                        <td className="p-2">
                          {a.topIssues.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {a.topIssues.map((i) => (
                                <Badge key={i.issue} variant="outline" className="text-[11px]">
                                  {i.issue} ({i.count})
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="motion-interactive gap-1"
                            onClick={() => setOpenRoute(a.route)}
                            aria-label={`Ver detalhes da rota ${a.route}`}
                          >
                            <Search className="h-3.5 w-3.5" aria-hidden /> Detalhes
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Consistência do sitemap particionado */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Consistência do sitemap (canônicos e noindex)</h2>
              <div className="flex items-center gap-2">
                <Badge className={consistency.passed ? BAND_CLASS.excellent : BAND_CLASS.critical}>
                  {consistency.checked === 0
                    ? 'sem dados'
                    : consistency.passed
                      ? 'consistente'
                      : 'inconsistências críticas'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="motion-interactive gap-1"
                  disabled={consistency.issues.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `sitemap-consistencia-${new Date().toISOString().slice(0, 10)}.csv`,
                      consistencyIssuesToCsv(consistency),
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> CSV
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Validação automática após cada atualização incremental: URL não canônica, canonical divergente,
              noindex listado, duplicata entre partições e rota fora da partição correta.
              URL sem auditoria fica como “não confirmada” — nunca como aprovada.
            </p>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
              <Metric icon={Gauge} label="Score de consistência" value={consistency.score != null ? String(consistency.score) : '—'} />
              <Metric icon={CheckCircle2} label="URLs verificadas" value={String(consistency.checked)} hint={`${consistency.audited} com auditoria`} />
              <Metric icon={FileWarning} label="Problemas" value={String(consistency.issues.length)} />
              <Metric icon={ShieldCheck} label="Partições" value={String(consistency.byPartition.length)} />
            </div>
            {consistency.issues.length > 0 && (
              <div className="max-h-80 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Severidade</th>
                      <th className="p-2">Problema</th>
                      <th className="p-2">URL</th>
                      <th className="p-2">Partição</th>
                      <th className="p-2">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consistency.issues.slice(0, 200).map((i, idx) => (
                      <tr key={`${i.kind}-${i.url}-${idx}`} className="border-t transition-colors hover:bg-muted/30">
                        <td className="p-2">
                          <Badge variant={i.severity === 'critical' ? 'destructive' : 'outline'}>{i.severity}</Badge>
                        </td>
                        <td className="p-2">{CONSISTENCY_LABEL[i.kind]}</td>
                        <td className="max-w-[22rem] truncate p-2 font-mono text-xs">{i.url}</td>
                        <td className="p-2 font-mono text-xs">{i.partition}</td>
                        <td className="p-2 text-xs text-muted-foreground">{i.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Drill-down por rota */}
          <Dialog open={!!openRoute} onOpenChange={(o) => !o && setOpenRoute(null)}>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-auto">
              <DialogHeader>
                <DialogTitle className="font-mono">{openRoute ?? ''}</DialogTitle>
                <DialogDescription>
                  Amostras do problema, diferenças em relação à build anterior e exportação do histórico.
                </DialogDescription>
              </DialogHeader>

              {drilldown && routeDiff && (
                <div className="space-y-4">
                  <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
                    <Metric icon={CheckCircle2} label="URLs" value={String(drilldown.total)} />
                    <Metric icon={FileWarning} label="Erros" value={String(drilldown.errors)} />
                    <Metric icon={AlertTriangle} label="Avisos" value={String(drilldown.warnings)} />
                    <Metric icon={ShieldCheck} label="Noindex" value={String(drilldown.noindex)} />
                  </div>

                  <div className="rounded-lg border p-3 text-sm">
                    <p className="mb-2 font-medium">Diferença vs build anterior</p>
                    {!routeDiff.hasPrevious ? (
                      <p className="text-xs text-muted-foreground">Não há build anterior para comparar.</p>
                    ) : (
                      <div className="grid gap-2 text-xs [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
                        <div>URLs: <DeltaPill value={routeDiff.totalDelta} /></div>
                        <div>Erros: <DeltaPill value={routeDiff.errorsDelta} /></div>
                        <div>Avisos: <DeltaPill value={routeDiff.warningsDelta} /></div>
                        <div>Noindex: <DeltaPill value={routeDiff.noindexDelta} /></div>
                      </div>
                    )}
                    {routeDiff.newProblemUrls.length > 0 && (
                      <p className="mt-2 text-xs text-destructive">
                        {routeDiff.newProblemUrls.length} URL(s) com problema novo: {routeDiff.newProblemUrls.slice(0, 5).join(', ')}
                      </p>
                    )}
                    {routeDiff.resolvedUrls.length > 0 && (
                      <p className="mt-1 text-xs text-emerald-600">
                        {routeDiff.resolvedUrls.length} URL(s) resolvida(s) desde a build anterior.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">Amostras do problema</p>
                    {drilldown.samples.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma URL com problema nesta rota.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
                            <tr>
                              <th className="p-2">URL</th>
                              <th className="p-2">HTTP</th>
                              <th className="p-2">Canonical</th>
                              <th className="p-2">Problemas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drilldown.samples.map((s) => (
                              <tr key={s.url} className="border-t">
                                <td className="max-w-[18rem] truncate p-2 font-mono">{s.url}</td>
                                <td className="p-2 tabular-nums">{s.http_status ?? '—'}</td>
                                <td className="max-w-[14rem] truncate p-2 font-mono">{s.canonical ?? '—'}</td>
                                <td className="p-2">{(s.issues ?? []).join(', ') || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="motion-interactive gap-2"
                    onClick={() =>
                      downloadCsv(
                        `seo-historico-${(openRoute ?? 'rota').replace(/\//g, '') || 'home'}.csv`,
                        routeHistoryToCsv(reports, openRoute as RouteGroup),
                      )
                    }
                  >
                    <Download className="h-4 w-4" aria-hidden /> Exportar histórico (CSV)
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Histórico por build */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Histórico por execução</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Quando</th>
                    <th className="p-2">URLs</th>
                    <th className="p-2">Indexáveis</th>
                    <th className="p-2">Noindex</th>
                    <th className="p-2">Erros</th>
                    <th className="p-2">Tendência</th>
                    <th className="p-2">robots</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t transition-colors hover:bg-muted/30">
                      <td className="p-2">{new Date(h.ran_at).toLocaleString('pt-BR')}</td>
                      <td className="p-2 tabular-nums">{h.total}</td>
                      <td className="p-2 tabular-nums">{h.indexable}</td>
                      <td className="p-2 tabular-nums">{h.noindex}</td>
                      <td className="p-2 tabular-nums">{h.errors}</td>
                      <td className="p-2">
                        {h.errorDelta === 0 ? (
                          <span className="text-muted-foreground">estável</span>
                        ) : h.errorDelta > 0 ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden /> +{h.errorDelta}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <TrendingDown className="h-3.5 w-3.5" aria-hidden /> {h.errorDelta}
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <Badge variant={h.robotsOk ? 'outline' : 'destructive'}>{h.robotsOk ? 'ok' : 'falha'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </AsyncBoundary>
    </div>
  );
}
