/**
 * AdminDbPerformancePage — Painel de performance do banco.
 * Mostra p95/mean atual do RPC nearby_providers, top queries e uso de índices GIST.
 * Permite capturar snapshot manual e visualizar histórico (linha p95).
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Database, RefreshCw, Camera, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer,
} from "recharts";

type Dashboard = {
  generated_at: string;
  nearby_providers: { calls: number; mean_ms: number; p95_ms: number; max_ms: number; total_ms: number };
  top_queries: Array<{ calls: number; mean_ms: number; p95_ms: number; max_ms: number; total_ms: number; rows: number; query: string }>;
  index_usage: Array<{ index: string; table: string; idx_scan: number; idx_tup_read: number; idx_tup_fetch: number; is_gist?: boolean }>;
  sizes: { providers_bytes: number; services_bytes: number; providers_rows: number; providers_active: number };
};

type Snapshot = {
  id: string;
  captured_at: string;
  reason: string;
  nearby_calls: number | null;
  nearby_mean_ms: number | null;
  nearby_p95_ms: number | null;
  nearby_max_ms: number | null;
  reset_after: boolean;
};

const SLO_P95_MS = 500;

function fmtBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "kB", "MB", "GB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

export default function AdminDbPerformancePage() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  async function loadDashboard() {
    const { data, error } = await supabase.rpc("admin_db_perf_dashboard");
    if (error) { toast.error("Falha ao carregar dashboard: " + error.message); return; }
    setDash(data as unknown as Dashboard);
  }
  async function loadSnapshots() {
    const { data, error } = await supabase
      .from("db_perf_snapshots")
      .select("id, captured_at, reason, nearby_calls, nearby_mean_ms, nearby_p95_ms, nearby_max_ms, reset_after")
      .order("captured_at", { ascending: false })
      .limit(60);
    if (error) { toast.error("Falha ao carregar histórico: " + error.message); return; }
    setSnaps((data ?? []) as Snapshot[]);
  }
  async function refresh() {
    setLoading(true);
    await Promise.all([loadDashboard(), loadSnapshots()]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function captureSnapshot(reset: boolean) {
    setCapturing(true);
    const { error } = await supabase.rpc("admin_capture_db_perf_snapshot", {
      _reason: reset ? "manual_reset" : "manual",
      _reset_after: reset,
    });
    setCapturing(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(reset ? "Snapshot salvo e contadores zerados" : "Snapshot salvo");
    await refresh();
  }

  const sloOk = (dash?.nearby_providers.p95_ms ?? 0) < SLO_P95_MS;
  const chartData = useMemo(
    () => snaps.slice().reverse().map((s) => ({
      t: new Date(s.captured_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      p95: Number(s.nearby_p95_ms ?? 0),
      mean: Number(s.nearby_mean_ms ?? 0),
    })),
    [snaps],
  );

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Database className="h-7 w-7" /> DB Performance</h1>
          <p className="text-muted-foreground">RPC nearby_providers · uso de índices GIST · histórico</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={() => captureSnapshot(false)} disabled={capturing}>
            <Camera className="h-4 w-4 mr-1" /> Capturar snapshot
          </Button>
          <Button size="sm" variant="secondary" onClick={() => captureSnapshot(true)} disabled={capturing}>
            <Camera className="h-4 w-4 mr-1" /> Snapshot + Reset
          </Button>
        </div>
      </div>

      {dash && (
        <>
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> p95 nearby</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dash.nearby_providers.p95_ms.toFixed(0)}<span className="text-base font-normal"> ms</span></div>
                <Badge variant={sloOk ? "default" : "destructive"} className="mt-2">
                  {sloOk ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Dentro do SLO</> : <><AlertTriangle className="h-3 w-3 mr-1" /> Acima de {SLO_P95_MS}ms</>}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Mean</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{dash.nearby_providers.mean_ms.toFixed(1)}<span className="text-base font-normal"> ms</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Calls</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{dash.nearby_providers.calls.toLocaleString("pt-BR")}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Providers ativos</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dash.sizes.providers_active.toLocaleString("pt-BR")}</div>
                <p className="text-xs text-muted-foreground mt-1">de {dash.sizes.providers_rows} · {fmtBytes(dash.sizes.providers_bytes)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Histórico p95 / mean (snapshots)</CardTitle></CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem snapshots ainda. Clique em "Capturar snapshot".</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" />
                    <YAxis label={{ value: "ms", angle: -90, position: "insideLeft" }} />
                    <ReTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="p95" stroke="hsl(var(--primary))" name="p95 (ms)" />
                    <Line type="monotone" dataKey="mean" stroke="hsl(var(--muted-foreground))" name="mean (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Uso de índices (GIST destacado)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Índice</th><th className="text-left">Tabela</th><th className="text-right">Scans</th><th className="text-right">Tup read</th></tr></thead>
                  <tbody>
                    {dash.index_usage.map((i) => (
                      <tr key={i.index} className="border-b last:border-0">
                        <td className="py-1.5 font-mono text-xs">
                          {i.index}
                          {i.is_gist && <Badge variant="outline" className="ml-2">GIST</Badge>}
                        </td>
                        <td className="text-muted-foreground">{i.table}</td>
                        <td className="text-right tabular-nums">{i.idx_scan.toLocaleString("pt-BR")}</td>
                        <td className="text-right tabular-nums text-muted-foreground">{i.idx_tup_read.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top queries por tempo total</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Query</th><th className="text-right">Calls</th><th className="text-right">Mean</th><th className="text-right">p95</th><th className="text-right">Max</th></tr></thead>
                  <tbody>
                    {dash.top_queries.map((q, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1.5 font-mono text-xs max-w-md truncate" title={q.query}>{q.query}</td>
                        <td className="text-right tabular-nums">{q.calls.toLocaleString("pt-BR")}</td>
                        <td className="text-right tabular-nums">{q.mean_ms} ms</td>
                        <td className="text-right tabular-nums">{q.p95_ms} ms</td>
                        <td className="text-right tabular-nums text-muted-foreground">{q.max_ms} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
