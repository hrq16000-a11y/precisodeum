/**
 * AdminUploadStressTestPage — bateria + observabilidade do `resilientUpload`.
 *
 * Permite ao admin escolher um cenário (Slow 3G / Fast 3G / 4G / Wi-Fi),
 * número de iterações e tamanho de arquivo simulado. Cada iteração dispara um
 * upload real contra o edge `optimize-image` com o test mode ativo. Métricas
 * vão para `upload_test_results` e a página exibe agregados, filtros avançados
 * e gráficos correlacionando latência por estágio com Web Vitals (LCP/INP/CLS).
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  setUploadTestMode,
  type NetworkScenario,
} from '@/lib/uploadTestMode';
import { resilientUpload } from '@/lib/uploadResilient';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  FileText,
  Filter,
  X,
  Copy,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type jsPDFType from 'jspdf';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';

if (!import.meta.env.DEV) {
  throw new Error('Esta página está disponível apenas em ambiente de desenvolvimento.');
}

interface AggregateRow {
  scenario: string;
  total: number;
  success: number;
  avgMs: number;
  avgAttempts: number;
}

interface UploadRow {
  created_at: string;
  scenario: string;
  success: boolean;
  total_ms: number;
  attempts: number;
  effective_type: string | null;
  downlink_mbps: number | null;
  device_ua: string | null;
  file_size_bytes: number | null;
  error_code: string | null;
  error_kind?: string | null;
  stage?: string | null;
  stage_latency_ms?: number | null;
  fallback_level?: number | null;
}

interface VitalRow {
  route: string;
  metric: string;
  value: number;
  rating: string | null;
  connection_type: string | null;
  created_at: string;
}

const SCENARIOS: { value: Exclude<NetworkScenario, 'off'>; label: string }[] = [
  { value: 'slow_3g', label: 'Slow 3G (alta latência + falhas)' },
  { value: 'fast_3g', label: 'Fast 3G (latência média)' },
  { value: '4g', label: '4G (baixa latência)' },
  { value: 'wifi', label: 'Wi-Fi (referência)' },
];

const STAGES = ['resize', 'convert', 'compress', 'upload', 'fallback'] as const;
const ERROR_KINDS = ['timeout', 'network', 'server', 'convert', 'compress', 'aborted', 'validation', 'unknown'];
const EFFECTIVE_TYPES = ['slow-2g', '2g', '3g', '4g'];

function downlinkBand(mbps: number | null | undefined): string {
  if (mbps == null) return 'desconhecido';
  if (mbps < 0.5) return '<0.5';
  if (mbps < 1.5) return '0.5–1.5';
  if (mbps < 5) return '1.5–5';
  if (mbps < 10) return '5–10';
  return '≥10';
}

/** Gera um File JPEG mínimo do tamanho desejado pra teste. */
function buildSyntheticFile(sizeKB: number): File {
  const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const pad = new Uint8Array(Math.max(0, sizeKB * 1024 - header.length - 2));
  const tail = new Uint8Array([0xff, 0xd9]);
  const blob = new Blob([header, pad, tail], { type: 'image/jpeg' });
  return new File([blob], `stress-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

const deviceFamily = (ua: string | null | undefined): string => {
  if (!ua) return 'desconhecido';
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/android|iphone|mobile/.test(s)) return 'mobile';
  return 'desktop';
};

export default function AdminUploadStressTestPage() {
  const [scenario, setScenario] = useState<Exclude<NetworkScenario, 'off'>>('fast_3g');
  const [iterations, setIterations] = useState(10);
  const [sizeKB, setSizeKB] = useState(300);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [allRows, setAllRows] = useState<UploadRow[]>([]);
  const [vitals, setVitals] = useState<VitalRow[]>([]);
  const [exporting, setExporting] = useState(false);

  // Filtros
  const [fStage, setFStage] = useState<string>('all');
  const [fEffective, setFEffective] = useState<string>('all');
  const [fBand, setFBand] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [fErrorKind, setFErrorKind] = useState<string>('all');
  const [fErrorCode, setFErrorCode] = useState<string>('');
  const [fScenario, setFScenario] = useState<string>('all');
  const [fDevice, setFDevice] = useState<string>('all');

  // Drawer de detalhes do evento
  const [selectedRow, setSelectedRow] = useState<UploadRow | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const loadAll = async () => {
    const { data } = await supabase
      .from('upload_test_results')
      .select(
        'scenario, success, total_ms, attempts, effective_type, downlink_mbps, device_ua, file_size_bytes, error_code, error_kind, stage, stage_latency_ms, fallback_level, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(2000);
    setAllRows((data as any[]) ?? []);

    // Web vitals (best-effort — tabela pode não existir em projetos antigos)
    try {
      const { data: v } = await (supabase.from('web_vitals_log' as any) as any)
        .select('route, metric, value, rating, connection_type, created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      setVitals((v as VitalRow[]) ?? []);
    } catch {
      setVitals([]);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const code = fErrorCode.trim().toLowerCase();
    return allRows.filter((r) => {
      if (fStage !== 'all' && (r.stage ?? '') !== fStage) return false;
      if (fEffective !== 'all' && (r.effective_type ?? '') !== fEffective) return false;
      if (fBand !== 'all' && downlinkBand(r.downlink_mbps) !== fBand) return false;
      if (fStatus === 'success' && !r.success) return false;
      if (fStatus === 'failure' && r.success) return false;
      if (fErrorKind !== 'all' && (r.error_kind ?? 'unknown') !== fErrorKind) return false;
      if (code && !(r.error_code ?? '').toLowerCase().includes(code)) return false;
      if (fScenario !== 'all' && r.scenario !== fScenario) return false;
      if (fDevice !== 'all' && deviceFamily(r.device_ua) !== fDevice) return false;
      return true;
    });
  }, [allRows, fStage, fEffective, fBand, fStatus, fErrorKind, fErrorCode, fScenario, fDevice]);

  const aggregates: AggregateRow[] = useMemo(() => {
    const groups = new Map<string, { total: number; success: number; sumMs: number; sumAttempts: number }>();
    for (const r of filtered) {
      const g = groups.get(r.scenario) ?? { total: 0, success: 0, sumMs: 0, sumAttempts: 0 };
      g.total += 1;
      if (r.success) g.success += 1;
      g.sumMs += r.total_ms;
      g.sumAttempts += r.attempts;
      groups.set(r.scenario, g);
    }
    return Array.from(groups.entries()).map(([sc, g]) => ({
      scenario: sc,
      total: g.total,
      success: g.success,
      avgMs: Math.round(g.sumMs / Math.max(1, g.total)),
      avgAttempts: +(g.sumAttempts / Math.max(1, g.total)).toFixed(2),
    }));
  }, [filtered]);

  const successRateBySc = useMemo(
    () =>
      aggregates.map((a) => ({
        ...a,
        rate: a.total === 0 ? 0 : Math.round((a.success / a.total) * 100),
      })),
    [aggregates]
  );

  // Latência média por estágio (entre os filtrados)
  const stageLatency = useMemo(() => {
    const map = new Map<string, { sum: number; count: number; fail: number }>();
    for (const r of filtered) {
      const s = r.stage ?? 'upload';
      const m = map.get(s) ?? { sum: 0, count: 0, fail: 0 };
      m.sum += r.stage_latency_ms ?? r.total_ms;
      m.count += 1;
      if (!r.success) m.fail += 1;
      map.set(s, m);
    }
    return STAGES.map((s) => {
      const m = map.get(s);
      return {
        stage: s,
        avgMs: m ? Math.round(m.sum / Math.max(1, m.count)) : 0,
        failRate: m ? Math.round((m.fail / Math.max(1, m.count)) * 100) : 0,
        total: m?.count ?? 0,
      };
    });
  }, [filtered]);

  // Distribuição por error_kind
  const byErrorKind = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      if (r.success) continue;
      const k = r.error_kind ?? 'unknown';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return ERROR_KINDS.map((k) => ({ kind: k, count: map.get(k) ?? 0 })).filter((x) => x.count > 0);
  }, [filtered]);

  // Web Vitals médios por effective_type (correlação)
  const vitalsByConn = useMemo(() => {
    const groups = new Map<string, { lcp: number[]; inp: number[]; cls: number[] }>();
    for (const v of vitals) {
      const k = v.connection_type ?? 'desconhecido';
      const g = groups.get(k) ?? { lcp: [], inp: [], cls: [] };
      if (v.metric === 'LCP') g.lcp.push(v.value);
      else if (v.metric === 'INP') g.inp.push(v.value);
      else if (v.metric === 'CLS') g.cls.push(v.value);
      groups.set(k, g);
    }
    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 100) / 100;
    return Array.from(groups.entries()).map(([k, g]) => ({
      connection: k,
      LCP: avg(g.lcp),
      INP: avg(g.inp),
      CLS: avg(g.cls),
    }));
  }, [vitals]);

  // Scatter: latência de upload x downlink (correlação direta)
  const scatterPoints = useMemo(
    () =>
      filtered
        .filter((r) => r.downlink_mbps != null && (r.stage ?? 'upload') === 'upload')
        .slice(0, 500)
        .map((r) => ({
          downlink: r.downlink_mbps,
          latency: r.stage_latency_ms ?? r.total_ms,
          ok: r.success,
        })),
    [filtered]
  );

  const downloadBlob = (blob: Blob, filename: string) => {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportCSV = () => {
    setExporting(true);
    try {
      const headers = [
        'created_at', 'scenario', 'device_family', 'success', 'attempts',
        'total_ms', 'stage', 'stage_latency_ms', 'effective_type', 'downlink_mbps',
        'downlink_band', 'file_size_bytes', 'error_kind', 'error_code', 'fallback_level', 'device_ua',
      ];
      const escape = (v: unknown) => {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n;]/.test(s) ? `"${s}"` : s;
      };
      const lines = [headers.join(',')];
      for (const r of filtered) {
        lines.push([
          r.created_at, r.scenario, deviceFamily(r.device_ua), r.success ? 'sim' : 'nao',
          r.attempts, r.total_ms, r.stage ?? '', r.stage_latency_ms ?? '',
          r.effective_type ?? '', r.downlink_mbps ?? '', downlinkBand(r.downlink_mbps),
          r.file_size_bytes ?? '', r.error_kind ?? '', r.error_code ?? '',
          r.fallback_level ?? '', r.device_ua ?? '',
        ].map(escape).join(','));
      }
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `upload-stress-test-${stamp}.csv`);
      toast.success(`CSV exportado (${filtered.length} linhas).`);
    } catch (err: any) {
      toast.error('Falha ao exportar CSV: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc: jsPDFType = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const margin = 36;
      let y = margin;

      doc.setFontSize(16);
      doc.text('Relatório — Upload Stress Test', margin, y);
      y += 18;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${filtered.length} resultados (filtrados)`, margin, y);
      y += 18;
      doc.setTextColor(0);

      doc.setFontSize(12);
      doc.text('Resumo por cenário', margin, y);
      y += 14;
      doc.setFontSize(9);
      ['Cenário', 'Total', 'Sucesso', 'Taxa', 'ms méd.', 'Tentativas'].forEach((h, i) =>
        doc.text(h, margin + i * 70, y)
      );
      y += 12;
      for (const a of successRateBySc) {
        [a.scenario, String(a.total), String(a.success), `${a.rate}%`, String(a.avgMs), String(a.avgAttempts)]
          .forEach((v, i) => doc.text(v, margin + i * 70, y));
        y += 12;
        if (y > 780) { doc.addPage(); y = margin; }
      }

      y += 10;
      doc.setFontSize(12);
      doc.text('Latência por estágio', margin, y);
      y += 14;
      doc.setFontSize(9);
      ['Estágio', 'Total', 'ms méd.', 'Falha %'].forEach((h, i) =>
        doc.text(h, margin + i * 90, y)
      );
      y += 12;
      for (const s of stageLatency) {
        [s.stage, String(s.total), String(s.avgMs), `${s.failRate}%`]
          .forEach((v, i) => doc.text(v, margin + i * 90, y));
        y += 12;
        if (y > 780) { doc.addPage(); y = margin; }
      }

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`upload-stress-test-${stamp}.pdf`);
      toast.success('PDF exportado.');
    } catch (err: any) {
      toast.error('Falha ao exportar PDF: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const runBattery = async () => {
    if (!projectId || !anonKey) {
      toast.error('Credenciais do projeto não disponíveis.');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Sessão expirou. Faça login novamente.');
      return;
    }

    setRunning(true);
    setProgress(0);
    setUploadTestMode({ scenario });

    const url = `https://${projectId}.supabase.co/functions/v1/optimize-image`;
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${session.access_token}`,
    };

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < iterations; i++) {
      const file = buildSyntheticFile(sizeKB);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'service-images');
      fd.append('folder', `stress-test/${session.user.id}`);

      try {
        await resilientUpload(url, fd, headers, {
          fileSizeBytes: file.size,
          maxAttempts: 3,
          timeoutMs: 25_000,
        });
        ok += 1;
      } catch {
        fail += 1;
      }
      setProgress(Math.round(((i + 1) / iterations) * 100));
    }

    setUploadTestMode({ scenario: 'off' });
    setRunning(false);
    toast.success(`Teste concluído: ${ok} sucesso · ${fail} falha`);
    await loadAll();
  };

  const clearFilters = () => {
    setFStage('all'); setFEffective('all'); setFBand('all'); setFStatus('all');
    setFErrorKind('all'); setFErrorCode(''); setFScenario('all'); setFDevice('all');
  };

  const recentRows = filtered.slice(0, 25);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6" /> Teste de stress de upload
        </h1>
        <p className="text-sm text-muted-foreground">
          Bateria de cenários 3G/4G + filtros e gráficos correlacionando estágios
          de upload com Web Vitals (LCP/INP/CLS). Resultados em <code>upload_test_results</code>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurar bateria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Cenário</Label>
              <Select value={scenario} onValueChange={(v) => setScenario(v as any)} disabled={running}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="iter">Iterações</Label>
              <Input id="iter" type="number" min={1} max={50} value={iterations}
                onChange={(e) => setIterations(Math.min(50, Math.max(1, +e.target.value || 1)))} disabled={running} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="size">Tamanho (KB)</Label>
              <Input id="size" type="number" min={50} max={2000} value={sizeKB}
                onChange={(e) => setSizeKB(Math.min(2000, Math.max(50, +e.target.value || 50)))} disabled={running} />
            </div>
          </div>

          {running && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> {progress}%
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 p-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span>Sobe arquivos sintéticos. Limpe <code>stress-test/</code> periodicamente.</span>
          </div>

          <Button onClick={runBattery} disabled={running} size="lg">
            {running ? 'Executando...' : 'Iniciar bateria'}
          </Button>
        </CardContent>
      </Card>

      {/* ─── FILTROS AVANÇADOS ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{filtered.length}/{allRows.length} resultados</span>
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FilterSelect label="Estágio" value={fStage} onChange={setFStage}
              options={['all', ...STAGES]} />
            <FilterSelect label="Status" value={fStatus} onChange={setFStatus}
              options={['all', 'success', 'failure']} />
            <FilterSelect label="Motivo (error_kind)" value={fErrorKind} onChange={setFErrorKind}
              options={['all', ...ERROR_KINDS]} />
            <FilterSelect label="Cenário" value={fScenario} onChange={setFScenario}
              options={['all', ...Array.from(new Set(allRows.map((r) => r.scenario)))]} />
            <FilterSelect label="effective_type" value={fEffective} onChange={setFEffective}
              options={['all', ...EFFECTIVE_TYPES]} />
            <FilterSelect label="Faixa downlink (Mbps)" value={fBand} onChange={setFBand}
              options={['all', '<0.5', '0.5–1.5', '1.5–5', '5–10', '≥10', 'desconhecido']} />
            <FilterSelect label="Dispositivo" value={fDevice} onChange={setFDevice}
              options={['all', 'mobile', 'tablet', 'desktop', 'desconhecido']} />
            <div className="space-y-1">
              <Label className="text-xs">error_code (busca)</Label>
              <Input value={fErrorCode} onChange={(e) => setFErrorCode(e.target.value)}
                placeholder="ex.: 503, timeout…" className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Exportar (resultados filtrados)</CardTitle>
          <span className="text-xs text-muted-foreground">{filtered.length} resultados</span>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting || filtered.length === 0}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={exporting || filtered.length === 0}>
            <FileText className="mr-1 h-4 w-4" /> PDF resumido
          </Button>
        </CardContent>
      </Card>

      {/* ─── GRÁFICOS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latência média por estágio</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageLatency}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <ReTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="avgMs" name="ms médio" fill="hsl(var(--accent))" />
                <Bar dataKey="failRate" name="% falha" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Falhas por motivo (error_kind)</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            {byErrorKind.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falha no recorte atual.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byErrorKind}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="kind" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <ReTooltip />
                  <Bar dataKey="count" name="ocorrências" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Web Vitals médios por conexão</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            {vitalsByConn.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem amostras de Web Vitals ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vitalsByConn}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="connection" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <ReTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="LCP" fill="hsl(var(--primary))" />
                  <Bar dataKey="INP" fill="hsl(var(--accent))" />
                  <Bar dataKey="CLS" fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latência de upload × downlink</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            {scatterPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem pontos com downlink medido.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="downlink" name="Mbps" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="latency" name="ms" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <ZAxis range={[40, 60]} />
                  <ReTooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={scatterPoints.filter((p) => p.ok)} name="sucesso" fill="hsl(var(--success))" />
                  <Scatter data={scatterPoints.filter((p) => !p.ok)} name="falha" fill="hsl(var(--destructive))" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── TAXA POR CENÁRIO ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxa de sucesso por cenário (filtrado)</CardTitle>
        </CardHeader>
        <CardContent>
          {successRateBySc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem resultados no recorte atual.</p>
          ) : (
            <div className="space-y-2">
              {successRateBySc.map((row) => (
                <div key={row.scenario} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={
                      row.rate >= 90 ? 'h-4 w-4 text-success'
                      : row.rate >= 70 ? 'h-4 w-4 text-warning'
                      : 'h-4 w-4 text-destructive'} />
                    <span className="font-medium">{row.scenario}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{row.rate}%</strong> sucesso</span>
                    <span>{row.total} runs</span>
                    <span>{row.avgMs}ms média</span>
                    <span>{row.avgAttempts} tentativas</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── ÚLTIMAS LINHAS ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 25 resultados (filtrados)</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum resultado.</p>
          ) : (
            <div className="overflow-x-auto">
              <p className="mb-2 text-[11px] text-muted-foreground">
                Clique em uma linha para ver os detalhes completos do evento.
              </p>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-2">Quando</th>
                    <th className="py-1 pr-2">Cenário</th>
                    <th className="py-1 pr-2">Estágio</th>
                    <th className="py-1 pr-2">OK</th>
                    <th className="py-1 pr-2">ms</th>
                    <th className="py-1 pr-2">Net</th>
                    <th className="py-1 pr-2">Motivo</th>
                    <th className="py-1 pr-2">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r, i) => (
                    <tr
                      key={i}
                      className="border-t cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-hidden"
                      onClick={() => setSelectedRow(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedRow(r);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Detalhes do evento ${i + 1}`}
                    >
                      <td className="py-1 pr-2">{new Date(r.created_at).toLocaleTimeString('pt-BR')}</td>
                      <td className="py-1 pr-2">{r.scenario}</td>
                      <td className="py-1 pr-2">{r.stage ?? '—'}</td>
                      <td className="py-1 pr-2">
                        {r.success ? <span className="text-success">sim</span> : <span className="text-destructive">não</span>}
                      </td>
                      <td className="py-1 pr-2">{r.stage_latency_ms ?? r.total_ms}</td>
                      <td className="py-1 pr-2">{r.effective_type ?? '—'}</td>
                      <td className="py-1 pr-2">{r.error_kind ?? '—'}</td>
                      <td className="py-1 pr-2 truncate max-w-[140px]">{r.error_code ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <UploadEventDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}
function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o === 'all' ? 'todos' : o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface UploadEventDrawerProps {
  row: UploadRow | null;
  onClose: () => void;
}
function UploadEventDrawer({ row, onClose }: UploadEventDrawerProps) {
  const open = !!row;
  const [stackOpen, setStackOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  // Tenta extrair stack/payload de error_code (algumas falhas serializam JSON ali)
  const parsedExtra = useMemo(() => {
    if (!row?.error_code) return null;
    try {
      const parsed = JSON.parse(row.error_code);
      return typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }, [row?.error_code]);

  // Sanitização do stack: corta em 8 KB e força string para evitar render perigoso.
  const safeStack = useMemo(() => {
    const s = parsedExtra && typeof parsedExtra === 'object' ? (parsedExtra as Record<string, unknown>).stack : null;
    if (s == null) return null;
    const str = typeof s === 'string' ? s : String(s);
    return str.length > 8192 ? `${str.slice(0, 8192)}\n… [truncado]` : str;
  }, [parsedExtra]);

  const rawJson = useMemo(() => (row ? JSON.stringify(row, null, 2) : ''), [row]);
  const errorJson = useMemo(() => {
    if (!row) return '';
    return JSON.stringify(
      {
        error_kind: row.error_kind ?? null,
        error_code: row.error_code ?? null,
        stage: row.stage ?? null,
        attempts: row.attempts ?? null,
        fallback_level: row.fallback_level ?? null,
      },
      null,
      2,
    );
  }, [row]);

  async function copyToClipboard(text: string, label: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success(`${label} copiado`);
    } catch {
      toast.error('Falha ao copiar');
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {row && (
          <>
            {/* Header sticky com ações de cópia rápidas */}
            <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {row.success ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                  Evento de upload
                </SheetTitle>
                <SheetDescription>
                  {new Date(row.created_at).toLocaleString('pt-BR')} · {row.scenario}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => copyToClipboard(rawJson, 'Payload')}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copiar payload
                </Button>
                {!row.success && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => copyToClipboard(errorJson, 'Erro')}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copiar erro
                  </Button>
                )}
                {safeStack && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => copyToClipboard(safeStack, 'Stack')}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copiar stack
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4 px-6 pb-8 pt-4 text-sm">
              {/* Bloco unificado: Tentativa + Estágio (reduz scroll) */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tentativa & estágio
                </h3>
                <dl className="grid grid-cols-3 gap-2 rounded-md border border-border bg-card/40 p-3">
                  <DetailRow label="Estágio" value={row.stage ?? '—'} />
                  <DetailRow
                    label="Status"
                    value={row.success ? 'sucesso' : 'falha'}
                    valueClassName={row.success ? 'text-success' : 'text-destructive'}
                  />
                  <DetailRow label="Tentativa(s)" value={String(row.attempts ?? 1)} />
                  <DetailRow label="Latência total" value={`${row.total_ms} ms`} />
                  <DetailRow
                    label="Estágio (ms)"
                    value={row.stage_latency_ms != null ? `${row.stage_latency_ms} ms` : '—'}
                  />
                  <DetailRow
                    label="Fallback"
                    value={row.fallback_level != null ? `nível ${row.fallback_level}` : 'sem fallback'}
                  />
                </dl>
              </section>

              {/* Erro + stack colapsável (pré-render seguro) */}
              {!row.success && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Erro
                  </h3>
                  <dl className="grid grid-cols-1 gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <DetailRow label="Tipo (error_kind)" value={row.error_kind ?? 'unknown'} />
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        error_code
                      </dt>
                      <dd className="mt-1 break-all rounded bg-background/60 p-2 font-mono text-[11px] leading-snug">
                        {row.error_code ?? '—'}
                      </dd>
                    </div>
                    {safeStack && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setStackOpen((o) => !o)}
                          className="flex w-full items-center justify-between rounded bg-background/60 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-background/80"
                          aria-expanded={stackOpen}
                        >
                          <span className="flex items-center gap-1">
                            {stackOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            Stack trace
                          </span>
                          <span className="text-[10px] normal-case text-muted-foreground/70">
                            {safeStack.length.toLocaleString('pt-BR')} chars
                          </span>
                        </button>
                        {stackOpen && (
                          // Render seguro: <pre> + texto puro (não dangerouslySetInnerHTML), tamanho limitado.
                          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[10px] leading-snug">
                            {safeStack}
                          </pre>
                        )}
                      </div>
                    )}
                  </dl>
                </section>
              )}

              {/* Rede / dispositivo */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Rede & dispositivo
                </h3>
                <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card/40 p-3">
                  <DetailRow label="effective_type" value={row.effective_type ?? '—'} />
                  <DetailRow
                    label="downlink (Mbps)"
                    value={row.downlink_mbps != null ? String(row.downlink_mbps) : '—'}
                  />
                  <DetailRow label="Faixa" value={downlinkBand(row.downlink_mbps)} />
                  <DetailRow label="Dispositivo" value={deviceFamily(row.device_ua)} />
                </dl>
                {row.device_ua && (
                  <p className="mt-2 break-all rounded bg-muted/30 p-2 font-mono text-[10px] leading-snug text-muted-foreground">
                    {row.device_ua}
                  </p>
                )}
              </section>

              {/* Arquivo */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Arquivo
                </h3>
                <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card/40 p-3">
                  <DetailRow
                    label="Tamanho"
                    value={
                      row.file_size_bytes != null
                        ? `${Math.round(row.file_size_bytes / 1024)} KB`
                        : '—'
                    }
                  />
                  <DetailRow label="Cenário (test mode)" value={row.scenario} />
                </dl>
              </section>

              {/* JSON bruto colapsável */}
              <section>
                <button
                  type="button"
                  onClick={() => setRawOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-card/60"
                  aria-expanded={rawOpen}
                >
                  <span className="flex items-center gap-1.5">
                    {rawOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Payload bruto
                  </span>
                  <span className="text-[10px] normal-case text-muted-foreground/70">
                    {rawJson.length.toLocaleString('pt-BR')} chars
                  </span>
                </button>
                {rawOpen && (
                  <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted/30 p-3 font-mono text-[10px] leading-snug">
                    {rawJson}
                  </pre>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  label,
  value,
  valueClassName = '',
}: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 font-medium tabular-nums ${valueClassName}`}>{value}</dd>
    </div>
  );
}
