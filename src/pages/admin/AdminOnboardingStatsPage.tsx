import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, MapPin, RefreshCcw } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

interface SourceRow {
  source: string;
  submits: number;
  completions: number;
  completion_rate: number | null;
}

interface FunnelRow {
  phase: string;
  enters: number;
  advances: number;
  errors: number;
  advance_rate: number | null;
}

interface StuckSummary {
  entered?: number;
  submitted?: number;
  stuck_no_submit?: number;
  submitted_without_preview?: number;
}

interface StatsPayload {
  since: string;
  days: number;
  by_source: SourceRow[];
  phase_funnel: FunnelRow[];
  pro_location_stuck: StuckSummary;
}

interface BySourceFunnelRow {
  draft_source: string;
  phase: string;
  enters: number;
  advances: number;
  errors: number;
  unique_users: number;
}

interface UserFunnelRow {
  user_id: string;
  phases_entered: number;
  phases_advanced: number;
  errors_total: number;
  last_phase: string | null;
  completed: boolean;
  draft_source: string;
  first_seen: string;
  last_seen: string;

const SOURCE_LABEL: Record<string, string> = {
  gps: "GPS",
  cep: "CEP",
  manual: "Manual",
  ip: "IP (aproximado)",
  unknown: "Não informado",
};

const SOURCE_COLOR: Record<string, string> = {
  gps: "hsl(var(--primary))",
  cep: "hsl(217 91% 60%)",
  manual: "hsl(43 96% 56%)",
  ip: "hsl(280 65% 60%)",
  unknown: "hsl(var(--muted-foreground))",
};

const WINDOW_OPTIONS = [7, 14, 30, 60, 90];

export default function AdminOnboardingStatsPage() {
  const { loading: adminLoading, isAdmin } = useAdmin();
  const [days, setDays] = useState(30);

  useEffect(() => {
    document.title = "Onboarding · Estatísticas | Admin";
  }, []);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-onboarding-stats", days],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_onboarding_stats", { _days: days });
      if (error) throw error;
      return data as StatsPayload;
    },
    enabled: !!isAdmin,
    staleTime: 60_000,
  });

  const sourceRows = useMemo<SourceRow[]>(() => {
    const rows = data?.by_source || [];
    return [...rows].sort((a, b) => (b.submits || 0) - (a.submits || 0));
  }, [data]);

  const funnelRows = useMemo<FunnelRow[]>(() => {
    const rows = data?.phase_funnel || [];
    return [...rows].sort((a, b) => (b.enters || 0) - (a.enters || 0)).slice(0, 12);
  }, [data]);

  const stuck = data?.pro_location_stuck || {};
  const stuckRate =
    stuck.entered && stuck.entered > 0
      ? Math.round(((stuck.stuck_no_submit || 0) / stuck.entered) * 1000) / 10
      : 0;
  const previewMissingRate =
    stuck.submitted && stuck.submitted > 0
      ? Math.round(((stuck.submitted_without_preview || 0) / stuck.submitted) * 1000) / 10
      : 0;

  if (adminLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-4 py-8" />
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-4 py-8">
          <p className="text-muted-foreground">Acesso restrito.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Onboarding · Estatísticas</h1>
              <p className="text-sm text-muted-foreground">
                Conclusão por origem (GPS/CEP/Manual/IP) e travamentos por etapa do cadastro.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border bg-card p-1">
                {WINDOW_OPTIONS.map((opt) => (
                  <Button
                    key={opt}
                    variant={days === opt ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDays(opt)}
                    className="h-7 px-2 text-xs"
                  >
                    {opt}d
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-1"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </header>

          {error ? (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">
                Erro carregando estatísticas: {(error as Error).message}
              </CardContent>
            </Card>
          ) : null}

          {/* KPIs de "stuck" no passo de localização */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" /> Entradas em pro_location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stuck.entered ?? 0}</div>
                <p className="text-xs text-muted-foreground">Sessões que abriram a etapa.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Travamentos (sem submit)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {stuck.stuck_no_submit ?? 0}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({stuckRate}%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Entraram em pro_location, mas nunca clicaram em Finalizar.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Activity className="h-4 w-4" /> Submits sem confirmar prévia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {stuck.submitted_without_preview ?? 0}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({previewMissingRate}%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Indica fluxo de fallback (GPS negado / manual / CEP).
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Conclusão por origem */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conclusão do onboarding por origem da localização</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 animate-pulse rounded-md bg-muted/40" />
              ) : sourceRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados na janela selecionada.</p>
              ) : (
                <>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sourceRows.map((r) => ({ ...r, label: SOURCE_LABEL[r.source] || r.source }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(v: number, key) => [v, key === "completion_rate" ? "Taxa de conclusão (%)" : key]}
                        />
                        <Legend />
                        <Bar dataKey="submits" name="Submits" radius={[4, 4, 0, 0]}>
                          {sourceRows.map((r) => (
                            <Cell key={r.source} fill={SOURCE_COLOR[r.source] || "hsl(var(--muted))"} />
                          ))}
                        </Bar>
                        <Bar dataKey="completions" name="Conclusões" radius={[4, 4, 0, 0]} fill="hsl(142 71% 45%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 text-left">Origem</th>
                          <th className="px-2 py-1 text-right">Submits</th>
                          <th className="px-2 py-1 text-right">Conclusões</th>
                          <th className="px-2 py-1 text-right">Taxa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceRows.map((r) => (
                          <tr key={r.source} className="border-t">
                            <td className="px-2 py-1">
                              <Badge variant="outline" className="font-normal">
                                {SOURCE_LABEL[r.source] || r.source}
                              </Badge>
                            </td>
                            <td className="px-2 py-1 text-right">{r.submits}</td>
                            <td className="px-2 py-1 text-right">{r.completions}</td>
                            <td className="px-2 py-1 text-right">
                              {r.completion_rate != null ? `${r.completion_rate}%` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Funnel por phase */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funnel por etapa (entradas vs. avanços vs. erros)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-64 animate-pulse rounded-md bg-muted/40" />
              ) : funnelRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados na janela selecionada.</p>
              ) : (
                <>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelRows} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="phase" width={140} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="enters" name="Entradas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="advances" name="Avanços" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="errors" name="Erros" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 text-left">Phase</th>
                          <th className="px-2 py-1 text-right">Entradas</th>
                          <th className="px-2 py-1 text-right">Avanços</th>
                          <th className="px-2 py-1 text-right">Erros</th>
                          <th className="px-2 py-1 text-right">Taxa de avanço</th>
                        </tr>
                      </thead>
                      <tbody>
                        {funnelRows.map((r) => (
                          <tr key={r.phase} className="border-t">
                            <td className="px-2 py-1 font-mono text-xs">{r.phase}</td>
                            <td className="px-2 py-1 text-right">{r.enters}</td>
                            <td className="px-2 py-1 text-right">{r.advances}</td>
                            <td className="px-2 py-1 text-right">
                              {r.errors > 0 ? (
                                <span className="text-destructive">{r.errors}</span>
                              ) : (
                                r.errors
                              )}
                            </td>
                            <td className="px-2 py-1 text-right">
                              {r.advance_rate != null ? `${r.advance_rate}%` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {data?.since ? (
            <p className="text-xs text-muted-foreground">
              Janela: últimos {data.days} dias (desde {new Date(data.since).toLocaleString("pt-BR")}).
            </p>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
