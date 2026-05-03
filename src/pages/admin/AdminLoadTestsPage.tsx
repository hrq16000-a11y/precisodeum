/**
 * AdminLoadTestsPage — Upload de k6 summary.json + histórico e gráficos por cenário.
 *
 * Como a execução de k6 não roda no browser, o admin executa local com:
 *   k6 run --summary-export=summary.json scripts/load-test.js
 * e faz upload do JSON aqui. A página parseia, gera relatório (p95/p99/erro/SLO)
 * e persiste em `k6_runs` para histórico/gráficos por cenário.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Activity, AlertTriangle, CheckCircle2, FileJson } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
} from "recharts";

const SLO_P95 = 500;
const SLO_ERR = 0.01;

type Run = {
  id: string;
  created_at: string;
  scenario: string;
  vus_max: number | null;
  iterations: number | null;
  http_reqs: number | null;
  duration_seconds: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  avg_ms: number | null;
  error_rate: number | null;
  passed_slo: boolean | null;
  notes: string | null;
};

function parseK6Summary(json: any) {
  const m = json?.metrics ?? {};
  const get = (k: string, f: string) => m[k]?.values?.[f] ?? null;
  const p95 = get("http_req_duration", "p(95)") ?? get("search_latency", "p(95)");
  const p99 = get("http_req_duration", "p(99)") ?? get("search_latency", "p(99)");
  const avg = get("http_req_duration", "avg") ?? null;
  const errRate = m.http_req_failed?.values?.rate ?? 0;
  const reqs = m.http_reqs?.values?.count ?? 0;
  const vus = m.vus_max?.values?.max ?? 0;
  const iter = m.iterations?.values?.count ?? 0;
  const duration = json?.state?.testRunDurationMs != null
    ? Math.round(json.state.testRunDurationMs / 1000)
    : null;
  const passed = (p95 ?? Infinity) < SLO_P95 && errRate < SLO_ERR;
  return { p95, p99, avg, errRate, reqs, vus, iter, duration, passed };
}

export default function AdminLoadTestsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scenario, setScenario] = useState("default");
  const [notes, setNotes] = useState("");
  const [parsing, setParsing] = useState(false);
  const [pending, setPending] = useState<ReturnType<typeof parseK6Summary> | null>(null);
  const [pendingRaw, setPendingRaw] = useState<any>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  async function loadRuns() {
    const { data, error } = await supabase
      .from("k6_runs")
      .select("id, created_at, scenario, vus_max, iterations, http_reqs, duration_seconds, p95_ms, p99_ms, avg_ms, error_rate, passed_slo, notes")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error("Falha ao carregar histórico: " + error.message); return; }
    setRuns((data ?? []) as Run[]);
  }
  useEffect(() => { loadRuns(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const parsed = parseK6Summary(json);
      setPending(parsed);
      setPendingRaw(json);
      toast.success("Summary parseado");
    } catch (err: any) {
      toast.error("JSON inválido: " + (err?.message ?? "erro"));
    } finally { setParsing(false); }
  }

  async function saveRun() {
    if (!pending || !pendingRaw) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("k6_runs").insert({
      scenario: scenario.trim() || "default",
      vus_max: pending.vus,
      iterations: pending.iter,
      http_reqs: pending.reqs,
      duration_seconds: pending.duration,
      p95_ms: pending.p95,
      p99_ms: pending.p99,
      avg_ms: pending.avg,
      error_rate: pending.errRate,
      passed_slo: pending.passed,
      notes: notes || null,
      raw_summary: pendingRaw,
      created_by: u?.user?.id ?? null,
    });
    if (error) { toast.error("Falha ao salvar: " + error.message); return; }
    toast.success("Run salvo");
    setPending(null); setPendingRaw(null); setNotes("");
    if (fileRef.current) fileRef.current.value = "";
    await loadRuns();
  }

  async function deleteRun(id: string) {
    if (!confirm("Excluir este run?")) return;
    const { error } = await supabase.from("k6_runs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRuns((r) => r.filter((x) => x.id !== id));
  }

  const scenarios = useMemo(() => Array.from(new Set(runs.map((r) => r.scenario))), [runs]);
  const chartData = useMemo(() => {
    const sorted = runs.slice().reverse();
    const map = new Map<string, any>();
    for (const r of sorted) {
      const t = new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      if (!map.has(t)) map.set(t, { t });
      const row = map.get(t);
      row[`p95__${r.scenario}`] = Number(r.p95_ms ?? 0);
      row[`err__${r.scenario}`] = Number(r.error_rate ?? 0) * 100;
    }
    return Array.from(map.values());
  }, [runs]);

  const palette = ["hsl(var(--primary))", "hsl(var(--bet-orange))", "hsl(var(--bet-green))", "hsl(var(--muted-foreground))"];

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Activity className="h-7 w-7" /> Load Tests (k6)</h1>
        <p className="text-muted-foreground">Upload do summary.json gerado por <code>k6 run --summary-export</code>. Histórico e gráficos por cenário.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Novo run</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">k6 run --summary-export=/tmp/k6.json scripts/load-test.js{"\n"}  -e SUPABASE_URL=$VITE_SUPABASE_URL -e SUPABASE_ANON_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY -e SUPABASE_JWT=$JWT</pre>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="scenario">Cenário</Label>
              <Input id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="ex: 100vu_30min" />
            </div>
            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="rev abc123, instância Pro" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} disabled={parsing} />
            <Button onClick={saveRun} disabled={!pending}><Upload className="h-4 w-4 mr-1" /> Salvar run</Button>
          </div>

          {pending && (
            <div className="border rounded p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <FileJson className="h-4 w-4" />
                <span className="font-medium">Pré-visualização</span>
                <Badge variant={pending.passed ? "default" : "destructive"}>
                  {pending.passed ? <><CheckCircle2 className="h-3 w-3 mr-1" /> SLO PASS</> : <><AlertTriangle className="h-3 w-3 mr-1" /> SLO FAIL</>}
                </Badge>
              </div>
              <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(120px,1fr))] text-sm">
                <div><div className="text-muted-foreground text-xs">p95</div><div className="font-bold">{pending.p95?.toFixed(1) ?? "-"} ms</div></div>
                <div><div className="text-muted-foreground text-xs">p99</div><div className="font-bold">{pending.p99?.toFixed(1) ?? "-"} ms</div></div>
                <div><div className="text-muted-foreground text-xs">Avg</div><div className="font-bold">{pending.avg?.toFixed(1) ?? "-"} ms</div></div>
                <div><div className="text-muted-foreground text-xs">Erro</div><div className="font-bold">{(pending.errRate * 100).toFixed(2)}%</div></div>
                <div><div className="text-muted-foreground text-xs">VUs</div><div className="font-bold">{pending.vus}</div></div>
                <div><div className="text-muted-foreground text-xs">Iters</div><div className="font-bold">{pending.iter}</div></div>
                <div><div className="text-muted-foreground text-xs">Reqs</div><div className="font-bold">{pending.reqs}</div></div>
                <div><div className="text-muted-foreground text-xs">Duração</div><div className="font-bold">{pending.duration ?? "-"}s</div></div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {pending.passed
                  ? "Sem gargalo. Sistema dentro de p95<500ms e erro<1%."
                  : (pending.p95 ?? 0) > SLO_P95 && pending.errRate < SLO_ERR
                    ? "Gargalo provável: CPU/banco. p95 acima do SLO sem erros — considerar upgrade de instância antes de aumentar pool."
                    : pending.errRate > 0.02
                      ? "Gargalo provável: pool/I-O. Migrar para Supavisor transaction mode mais agressivo."
                      : "Latência acima do SLO; investigar índices e plano da query."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle>p95 por cenário (ms)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  {scenarios.map((s, i) => (
                    <Line key={s} type="monotone" dataKey={`p95__${s}`} stroke={palette[i % palette.length]} name={`p95 ${s}`} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Taxa de erro por cenário (%)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" />
                  <YAxis />
                  <ReTooltip />
                  <Legend />
                  {scenarios.map((s, i) => (
                    <Line key={s} type="monotone" dataKey={`err__${s}`} stroke={palette[i % palette.length]} name={`erro% ${s}`} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico ({runs.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-2">Data</th><th className="text-left">Cenário</th>
                <th className="text-right">VUs</th><th className="text-right">p95</th><th className="text-right">p99</th>
                <th className="text-right">Erro</th><th className="text-center">SLO</th><th></th>
              </tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1.5">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td>{r.scenario}</td>
                    <td className="text-right tabular-nums">{r.vus_max ?? "-"}</td>
                    <td className="text-right tabular-nums">{r.p95_ms?.toFixed(1) ?? "-"} ms</td>
                    <td className="text-right tabular-nums">{r.p99_ms?.toFixed(1) ?? "-"} ms</td>
                    <td className="text-right tabular-nums">{((r.error_rate ?? 0) * 100).toFixed(2)}%</td>
                    <td className="text-center"><Badge variant={r.passed_slo ? "default" : "destructive"}>{r.passed_slo ? "PASS" : "FAIL"}</Badge></td>
                    <td><Button variant="ghost" size="sm" onClick={() => deleteRun(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
                {runs.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum run registrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
