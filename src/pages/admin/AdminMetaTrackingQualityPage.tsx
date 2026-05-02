/**
 * Admin — Qualidade dos metadados de cadastro (meta_tracking)
 *
 * Página oculta (rota /admin/meta-tracking-quality, sem item de menu).
 * Consolida providers.meta_tracking via RPC `admin_meta_tracking_quality`
 * e mostra:
 *  - cobertura geral + cobertura por sub-objeto
 *  - distribuição por tipo de conexão (4G/Wifi/etc.)
 *  - distribuição por tipo de dispositivo (mobile/desktop/tablet)
 *  - % de profissionais "em campo" (was_moving=true)
 *  - média de precisão de GPS por categoria de serviço
 *  - alerta de degradação quando a cobertura cai abaixo de 60%
 */
import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Loader2, RefreshCcw } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSeoHead } from "@/hooks/useSeoHead";

type Bucket = { key: string; count: number };

type Quality = {
  generated_at: string;
  totals: {
    providers_total: number;
    providers_with_meta: number;
    coverage_pct: number;
    last7_with_meta: number;
  };
  field_coverage: Record<string, number>;
  connection_type: Bucket[] | null;
  device_type: Bucket[] | null;
  movement: { in_field: number; sampled: number; in_field_pct: number };
  referrer_kind: Bucket[] | null;
  gps_accuracy_by_category:
    | { category: string; avg_accuracy_m: number; samples: number }[]
    | null;
};

const COVERAGE_ALERT_THRESHOLD = 60;

const FIELD_LABELS: Record<string, string> = {
  has_attribution: "Atribuição (referrer/UTM)",
  has_network: "Conexão",
  has_movement: "Movimento (GPS)",
  has_terms: "Termos vinculados",
  has_network_type: "Tipo de conexão preenchido",
  has_referrer_kind: "Classificação de origem",
};

export default function AdminMetaTrackingQualityPage() {
  const [data, setData] = useState<Quality | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeoHead({
    title: "Qualidade meta_tracking | Admin",
    description: "Estatísticas internas de coleta de metadados de cadastro.",
    noindex: true,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: row, error } = await (supabase.rpc as any)("admin_meta_tracking_quality");
      if (error) throw error;
      setData(row as Quality);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const coverage = data?.totals.coverage_pct ?? 0;
  const degraded = !loading && data && coverage < COVERAGE_ALERT_THRESHOLD;

  return (
    <AdminLayout>
      <div className="container max-w-5xl py-6">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              Qualidade dos metadados (meta_tracking)
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Consolida <code className="font-mono">providers.meta_tracking</code> de
              todos os profissionais. Página oculta — sem item de menu.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Recarregar
          </Button>
        </header>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {degraded ? (
          <div
            className="mb-4 flex items-start gap-2 rounded-md border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
            data-testid="meta-tracking-degraded"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong>Coleta degradada:</strong> apenas {coverage}% dos profissionais
              têm meta_tracking. Verifique falhas de consentimento de cookies, bloqueio
              de Network Information API ou regressão no fluxo de cadastro.
            </div>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando estatísticas…
          </div>
        ) : null}

        {data ? (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-4">
              <Kpi label="Profissionais totais" value={data.totals.providers_total.toString()} />
              <Kpi label="Com meta_tracking" value={data.totals.providers_with_meta.toString()} />
              <Kpi
                label="Cobertura"
                value={`${coverage}%`}
                tone={coverage >= 80 ? "good" : coverage >= 60 ? "warn" : "bad"}
              />
              <Kpi
                label="Últimos 7 dias"
                value={data.totals.last7_with_meta.toString()}
              />
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Cobertura por campo
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {Object.entries(data.field_coverage).map(([k, v]) => {
                  const total = data.totals.providers_with_meta || 1;
                  const pct = Math.round((v / total) * 100);
                  return (
                    <li key={k} className="flex items-center gap-3 text-xs">
                      <span className="w-48 truncate text-muted-foreground">
                        {FIELD_LABELS[k] || k}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right font-mono text-[11px]">
                        {pct}% ({v})
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionCard
                title="Tipo de conexão"
                buckets={data.connection_type || []}
                emptyText="Sem dados de conexão (Network Information API indisponível)"
              />
              <DistributionCard
                title="Tipo de dispositivo"
                buckets={data.device_type || []}
                emptyText="Sem dados de dispositivo"
              />
              <DistributionCard
                title="Origem do tráfego (referrer)"
                buckets={data.referrer_kind || []}
                emptyText="Sem dados de origem"
              />

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  Em campo (was_moving)
                </h3>
                {data.movement.sampled > 0 ? (
                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground">
                      {data.movement.in_field} de {data.movement.sampled} profissionais
                      foram detectados em movimento durante o cadastro.
                    </p>
                    <div className="mt-2 h-3 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${data.movement.in_field_pct}%` }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[11px]">{data.movement.in_field_pct}%</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sem amostras de movimento ainda.
                  </p>
                )}
              </div>
            </div>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Precisão média de GPS por categoria
              </h2>
              {data.gps_accuracy_by_category && data.gps_accuracy_by_category.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1">Categoria</th>
                      <th className="py-1">Precisão média</th>
                      <th className="py-1">Amostras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.gps_accuracy_by_category.map((row) => (
                      <tr key={row.category} className="border-b border-border/40">
                        <td className="py-1.5 text-foreground">{row.category}</td>
                        <td className="py-1.5 font-mono">± {row.avg_accuracy_m} m</td>
                        <td className="py-1.5 font-mono">{row.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ainda não há amostras de precisão GPS.
                </p>
              )}
            </section>

            <p className="text-[11px] text-muted-foreground">
              Gerado em {new Date(data.generated_at).toLocaleString("pt-BR")}
            </p>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : tone === "bad"
      ? "border-destructive/40 bg-destructive/5"
      : "border-border bg-card";
  return (
    <div className={`rounded-xl border p-3 ${toneCls}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function DistributionCard({
  title,
  buckets,
  emptyText,
}: {
  title: string;
  buckets: Bucket[];
  emptyText: string;
}) {
  const total = buckets.reduce((acc, b) => acc + b.count, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {buckets.map((b) => {
            const pct = Math.round((b.count / total) * 100);
            return (
              <li key={b.key} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate text-muted-foreground">{b.key}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right font-mono text-[11px]">
                  {pct}% ({b.count})
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
