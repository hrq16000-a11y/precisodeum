/**
 * AdminSitemapAuditPage — Roda auditoria do sitemap.xml e robots.txt e mostra
 * findings (canonical inválido, noindex em URL indexável, HTTP errors).
 * Persiste histórico em public.seo_audit_reports.
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertTriangle, CheckCircle2, Loader2, RefreshCcw, Search, Eye, ShieldAlert,
} from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { useSeoHead } from '@/hooks/useSeoHead';
import { toast } from 'sonner';

interface Finding {
  url: string;
  status: 'ok' | 'warning' | 'error';
  http_status?: number;
  canonical?: string | null;
  noindex?: boolean;
  issues: string[];
  source_sitemap?: string;
}

interface Report {
  id: string;
  ran_at: string;
  total_urls: number;
  ok_count: number;
  warning_count: number;
  error_count: number;
  robots_ok: boolean;
  robots_issues: string[];
  sitemap_url: string | null;
  findings: Finding[];
  duration_ms: number | null;
}

export default function AdminSitemapAuditPage() {
  useSeoHead({ title: 'Auditoria Sitemap Auditoria SEO — Admin Robots — Admin', description: 'Auditoria de sitemap.xml e robots.txt.' });
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [sample, setSample] = useState('60');
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('seo_audit_reports')
      .select('*')
      .order('ran_at', { ascending: false })
      .limit(20);
    if (error) {
      toast.error('Falha ao carregar relatórios');
    } else {
      setReports((data as unknown as Report[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  async function runAudit() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-audit', {
        body: { sample: parseInt(sample, 10) || 60 },
      });
      if (error) throw error;
      toast.success(`Auditoria concluída: ${data.ok_count} ok, ${data.warning_count} aviso, ${data.error_count} erro`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao rodar auditoria');
    } finally {
      setRunning(false);
    }
  }

  const filteredFindings = useMemo(() => {
    if (!selected) return [];
    let list = selected.findings || [];
    if (filter !== 'all') list = list.filter((f) => f.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.url.toLowerCase().includes(q) || f.issues.some((i) => i.toLowerCase().includes(q)));
    }
    return list;
  }, [selected, filter, search]);

  if (adminLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldAlert className="h-6 w-6" /> Auditoria SEO</h1>
          <p className="text-sm text-muted-foreground">
            Verifica sitemap.xml e robots.txt, sinaliza canonical inválido, noindex incorreto e HTTP errors.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="sample" className="text-xs">Amostra</Label>
            <Input id="sample" value={sample} onChange={(e) => setSample(e.target.value)} className="w-24" />
          </div>
          <Button onClick={runAudit} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Rodar auditoria
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Histórico</h2>
        {loading ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma auditoria ainda. Rode a primeira acima.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">{new Date(r.ran_at).toLocaleString('pt-BR')}</div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="outline">{r.total_urls} URLs</Badge>
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />{r.ok_count}</Badge>
                    {r.warning_count > 0 && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />{r.warning_count}</Badge>
                    )}
                    {r.error_count > 0 && (
                      <Badge variant="destructive">{r.error_count} erro(s)</Badge>
                    )}
                    <Badge variant={r.robots_ok ? 'outline' : 'destructive'}>
                      robots.txt {r.robots_ok ? 'ok' : 'falha'}
                    </Badge>
                    {r.duration_ms != null && <Badge variant="outline">{(r.duration_ms / 1000).toFixed(1)}s</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                  <Eye className="mr-1 h-4 w-4" /> Ver findings
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Findings da auditoria</DialogTitle>
            <DialogDescription>
              {selected && <>Rodada em {new Date(selected.ran_at).toLocaleString('pt-BR')}</>}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              {selected.robots_issues?.length > 0 && (
                <Card className="border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="text-sm font-medium text-amber-800">robots.txt</div>
                  <ul className="mt-1 list-inside list-disc text-xs text-amber-900">
                    {selected.robots_issues.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </Card>
              )}
              <div className="flex flex-wrap gap-2">
                {(['all', 'error', 'warning'] as const).map((f) => (
                  <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'Todos' : f === 'error' ? 'Erros' : 'Avisos'}
                  </Button>
                ))}
                <div className="relative ml-auto">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar URL ou problema" className="w-64 pl-8" />
                </div>
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {filteredFindings.map((f, idx) => (
                  <div key={idx} className="rounded-md border p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <a href={f.url} target="_blank" rel="noreferrer noopener" className="break-all font-mono text-xs hover:underline">{f.url}</a>
                      <Badge variant={f.status === 'ok' ? 'outline' : f.status === 'warning' ? 'secondary' : 'destructive'}>
                        {f.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {f.http_status != null && <span>HTTP {f.http_status}</span>}
                      {f.noindex && <span className="text-destructive">noindex</span>}
                      {f.canonical && <span className="break-all">canonical: {f.canonical}</span>}
                    </div>
                    {f.issues.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-xs">
                        {f.issues.map((i, j) => <li key={j}>{i}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
                {filteredFindings.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhum finding com esse filtro.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
