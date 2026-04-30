/**
 * AdminUploadStressTestPage — bateria de testes do `resilientUpload`
 *
 * Permite ao admin escolher um cenário (Slow 3G / Fast 3G / 4G / Wi-Fi),
 * número de iterações e tamanho de arquivo simulado. Cada iteração dispara um
 * upload real contra o edge `optimize-image` com o test mode ativo (latência
 * artificial + falhas determinísticas). Métricas vão para `upload_test_results`
 * e a página exibe agregados por cenário e dispositivo.
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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  setUploadTestMode,
  type NetworkScenario,
} from '@/lib/uploadTestMode';
import { resilientUpload } from '@/lib/uploadResilient';
import { supabase } from '@/integrations/supabase/client';
import { Activity, AlertTriangle, CheckCircle2, Loader2, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';

interface AggregateRow {
  scenario: string;
  total: number;
  success: number;
  avgMs: number;
  avgAttempts: number;
}

const SCENARIOS: { value: Exclude<NetworkScenario, 'off'>; label: string }[] = [
  { value: 'slow_3g', label: 'Slow 3G (alta latência + falhas)' },
  { value: 'fast_3g', label: 'Fast 3G (latência média)' },
  { value: '4g', label: '4G (baixa latência)' },
  { value: 'wifi', label: 'Wi-Fi (referência)' },
];

/** Gera um File JPEG mínimo do tamanho desejado pra teste (não precisa ser válido visualmente — o edge rejeita formatos inválidos, mas usamos um header JPEG real). */
function buildSyntheticFile(sizeKB: number): File {
  // header JPEG mínimo
  const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const pad = new Uint8Array(Math.max(0, sizeKB * 1024 - header.length - 2));
  const tail = new Uint8Array([0xff, 0xd9]);
  const blob = new Blob([header, pad, tail], { type: 'image/jpeg' });
  return new File([blob], `stress-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

export default function AdminUploadStressTestPage() {
  const [scenario, setScenario] = useState<Exclude<NetworkScenario, 'off'>>('fast_3g');
  const [iterations, setIterations] = useState(10);
  const [sizeKB, setSizeKB] = useState(300);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [aggregates, setAggregates] = useState<AggregateRow[]>([]);
  const [recentRows, setRecentRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const loadAggregates = async () => {
    const { data, error } = await supabase
      .from('upload_test_results')
      .select('scenario, success, total_ms, attempts, effective_type, downlink_mbps, device_ua, file_size_bytes, error_code, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) {
      console.error(error);
      return;
    }
    const rows = data ?? [];
    setRecentRows(rows.slice(0, 25));
    setAllRows(rows);

    const groups = new Map<string, { total: number; success: number; sumMs: number; sumAttempts: number }>();
    for (const r of rows) {
      const g = groups.get(r.scenario) ?? { total: 0, success: 0, sumMs: 0, sumAttempts: 0 };
      g.total += 1;
      if (r.success) g.success += 1;
      g.sumMs += r.total_ms;
      g.sumAttempts += r.attempts;
      groups.set(r.scenario, g);
    }
    setAggregates(
      Array.from(groups.entries()).map(([sc, g]) => ({
        scenario: sc,
        total: g.total,
        success: g.success,
        avgMs: Math.round(g.sumMs / Math.max(1, g.total)),
        avgAttempts: +(g.sumAttempts / Math.max(1, g.total)).toFixed(2),
      })),
    );
  };

  /** Detecta família do dispositivo a partir do UA (mobile / tablet / desktop). */
  const deviceFamily = (ua: string | null | undefined): string => {
    if (!ua) return 'desconhecido';
    const s = ua.toLowerCase();
    if (/ipad|tablet/.test(s)) return 'tablet';
    if (/android|iphone|mobile/.test(s)) return 'mobile';
    return 'desktop';
  };

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
        'total_ms', 'effective_type', 'downlink_mbps', 'file_size_bytes', 'error_code', 'device_ua',
      ];
      const escape = (v: unknown) => {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n;]/.test(s) ? `"${s}"` : s;
      };
      const lines = [headers.join(',')];
      for (const r of allRows) {
        lines.push([
          r.created_at,
          r.scenario,
          deviceFamily(r.device_ua),
          r.success ? 'sim' : 'nao',
          r.attempts,
          r.total_ms,
          r.effective_type ?? '',
          r.downlink_mbps ?? '',
          r.file_size_bytes ?? '',
          r.error_code ?? '',
          r.device_ua ?? '',
        ].map(escape).join(','));
      }
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `upload-stress-test-${stamp}.csv`);
      toast.success(`CSV exportado (${allRows.length} linhas).`);
    } catch (err: any) {
      toast.error('Falha ao exportar CSV: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const margin = 36;
      let y = margin;

      doc.setFontSize(16);
      doc.text('Relatório — Upload Stress Test', margin, y);
      y += 18;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · ${allRows.length} resultados`, margin, y);
      y += 18;
      doc.setTextColor(0);

      // Agregados por cenário
      doc.setFontSize(12);
      doc.text('Resumo por cenário', margin, y);
      y += 14;
      doc.setFontSize(9);
      doc.text('Cenário', margin, y);
      doc.text('Total', margin + 140, y);
      doc.text('Sucesso', margin + 200, y);
      doc.text('Taxa', margin + 270, y);
      doc.text('ms méd.', margin + 320, y);
      doc.text('Tentativas', margin + 390, y);
      y += 12;
      for (const a of aggregates) {
        const rate = a.total === 0 ? 0 : Math.round((a.success / a.total) * 100);
        doc.text(a.scenario, margin, y);
        doc.text(String(a.total), margin + 140, y);
        doc.text(String(a.success), margin + 200, y);
        doc.text(`${rate}%`, margin + 270, y);
        doc.text(String(a.avgMs), margin + 320, y);
        doc.text(String(a.avgAttempts), margin + 390, y);
        y += 12;
        if (y > 780) { doc.addPage(); y = margin; }
      }

      // Agregados por dispositivo
      y += 10;
      doc.setFontSize(12);
      doc.text('Resumo por dispositivo', margin, y);
      y += 14;
      doc.setFontSize(9);
      const byDevice = new Map<string, { total: number; success: number; sumMs: number }>();
      for (const r of allRows) {
        const k = deviceFamily(r.device_ua);
        const g = byDevice.get(k) ?? { total: 0, success: 0, sumMs: 0 };
        g.total += 1; if (r.success) g.success += 1; g.sumMs += r.total_ms;
        byDevice.set(k, g);
      }
      doc.text('Dispositivo', margin, y);
      doc.text('Total', margin + 140, y);
      doc.text('Taxa', margin + 200, y);
      doc.text('ms méd.', margin + 270, y);
      y += 12;
      for (const [k, g] of byDevice) {
        const rate = g.total === 0 ? 0 : Math.round((g.success / g.total) * 100);
        doc.text(k, margin, y);
        doc.text(String(g.total), margin + 140, y);
        doc.text(`${rate}%`, margin + 200, y);
        doc.text(String(Math.round(g.sumMs / Math.max(1, g.total))), margin + 270, y);
        y += 12;
        if (y > 780) { doc.addPage(); y = margin; }
      }

      // Agregados por dia
      y += 10;
      doc.setFontSize(12);
      doc.text('Resumo por data', margin, y);
      y += 14;
      doc.setFontSize(9);
      const byDay = new Map<string, { total: number; success: number }>();
      for (const r of allRows) {
        const k = String(r.created_at).slice(0, 10);
        const g = byDay.get(k) ?? { total: 0, success: 0 };
        g.total += 1; if (r.success) g.success += 1;
        byDay.set(k, g);
      }
      const sortedDays = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
      doc.text('Data', margin, y);
      doc.text('Total', margin + 140, y);
      doc.text('Sucesso', margin + 200, y);
      doc.text('Taxa', margin + 270, y);
      y += 12;
      for (const [k, g] of sortedDays) {
        const rate = g.total === 0 ? 0 : Math.round((g.success / g.total) * 100);
        doc.text(k, margin, y);
        doc.text(String(g.total), margin + 140, y);
        doc.text(String(g.success), margin + 200, y);
        doc.text(`${rate}%`, margin + 270, y);
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

  useEffect(() => {
    loadAggregates();
  }, []);

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
    await loadAggregates();
  };

  const successRateBySc = useMemo(() => {
    return aggregates.map((a) => ({
      ...a,
      rate: a.total === 0 ? 0 : Math.round((a.success / a.total) * 100),
    }));
  }, [aggregates]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6" /> Teste de stress de upload
        </h1>
        <p className="text-sm text-muted-foreground">
          Simula conexões 3G/4G lentas e falhas para validar o `resilientUpload` e medir taxa de
          sucesso por dispositivo. Resultados gravados em `upload_test_results`.
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
              <Select
                value={scenario}
                onValueChange={(v) => setScenario(v as Exclude<NetworkScenario, 'off'>)}
                disabled={running}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="iter">Iterações</Label>
              <Input
                id="iter"
                type="number"
                min={1}
                max={50}
                value={iterations}
                onChange={(e) => setIterations(Math.min(50, Math.max(1, +e.target.value || 1)))}
                disabled={running}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="size">Tamanho por arquivo (KB)</Label>
              <Input
                id="size"
                type="number"
                min={50}
                max={2000}
                value={sizeKB}
                onChange={(e) => setSizeKB(Math.min(2000, Math.max(50, +e.target.value || 50)))}
                disabled={running}
              />
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
            <span>
              Este teste sobe arquivos sintéticos para o bucket. Limpe a pasta{' '}
              <code>stress-test/</code> periodicamente.
            </span>
          </div>

          <Button onClick={runBattery} disabled={running} size="lg">
            {running ? 'Executando...' : 'Iniciar bateria'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxa de sucesso por cenário</CardTitle>
        </CardHeader>
        <CardContent>
          {successRateBySc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem resultados ainda.</p>
          ) : (
            <div className="space-y-2">
              {successRateBySc.map((row) => (
                <div
                  key={row.scenario}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={
                        row.rate >= 90
                          ? 'h-4 w-4 text-success'
                          : row.rate >= 70
                          ? 'h-4 w-4 text-warning'
                          : 'h-4 w-4 text-destructive'
                      }
                    />
                    <span className="font-medium">{row.scenario}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{row.rate}%</strong> sucesso
                    </span>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 25 resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum resultado registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-2">Quando</th>
                    <th className="py-1 pr-2">Cenário</th>
                    <th className="py-1 pr-2">OK</th>
                    <th className="py-1 pr-2">ms</th>
                    <th className="py-1 pr-2">Retries</th>
                    <th className="py-1 pr-2">Net</th>
                    <th className="py-1 pr-2">UA</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1 pr-2">
                        {new Date(r.created_at).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="py-1 pr-2">{r.scenario}</td>
                      <td className="py-1 pr-2">
                        {r.success ? (
                          <span className="text-success">sim</span>
                        ) : (
                          <span className="text-destructive">não</span>
                        )}
                      </td>
                      <td className="py-1 pr-2">{r.total_ms}</td>
                      <td className="py-1 pr-2">{r.attempts}</td>
                      <td className="py-1 pr-2">{r.effective_type ?? '—'}</td>
                      <td className="py-1 pr-2 truncate max-w-[180px]">{r.device_ua}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
