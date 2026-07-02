import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Rss, FileText, Loader2, ExternalLink, Upload, RotateCcw } from 'lucide-react';
import { parseJobText } from '@/lib/jobTextParser';

export default function AdminJobsImportPage() {
  const { isAdmin, loading } = useAdmin();
  const qc = useQueryClient();
  const [newSrc, setNewSrc] = useState({ name: '', feed_url: '', is_trusted: false, default_city: '', default_state: '', default_opportunity_type: 'emprego' });
  const [running, setRunning] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: sources = [] } = useQuery({
    queryKey: ['job-import-sources'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('job_import_sources').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['job-import-logs'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('job_import_log').select('*').order('created_at', { ascending: false }).limit(30);
      return data ?? [];
    },
    enabled: isAdmin,
    refetchInterval: 10000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-min'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id,name').order('name');
      return data ?? [];
    },
  });

  if (loading) return <AdminLayout><div className="p-6">Carregando…</div></AdminLayout>;
  if (!isAdmin) return <AdminLayout><div className="p-6">Acesso negado.</div></AdminLayout>;

  const addSource = async () => {
    if (!newSrc.name || !newSrc.feed_url) { toast.error('Nome e URL do feed são obrigatórios.'); return; }
    const { error } = await (supabase as any).from('job_import_sources').insert({ ...newSrc, source_type: 'rss' });
    if (error) { toast.error(error.message); return; }
    toast.success('Fonte cadastrada.');
    setNewSrc({ name: '', feed_url: '', is_trusted: false, default_city: '', default_state: '', default_opportunity_type: 'emprego' });
    qc.invalidateQueries({ queryKey: ['job-import-sources'] });
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await (supabase as any).from('job_import_sources').update({ is_active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['job-import-sources'] });
  };

  const toggleTrusted = async (id: string, is_trusted: boolean) => {
    await (supabase as any).from('job_import_sources').update({ is_trusted }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['job-import-sources'] });
  };

  const deleteSource = async (id: string) => {
    if (!confirm('Excluir esta fonte? Vagas já importadas serão preservadas.')) return;
    await (supabase as any).from('job_import_sources').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['job-import-sources'] });
    toast.success('Fonte excluída.');
  };

  const runImport = async (source_id?: string) => {
    setRunning(source_id ?? 'all');
    try {
      const { data, error } = await supabase.functions.invoke('import-jobs-rss', {
        body: { source_id, trigger_mode: 'manual' },
      });
      if (error) throw error;
      const total = (data?.results ?? []).reduce((s: number, r: any) => s + r.inserted_count, 0);
      toast.success(`Importação concluída: ${total} novas vagas.`);
      qc.invalidateQueries({ queryKey: ['job-import-logs'] });
      qc.invalidateQueries({ queryKey: ['job-import-sources'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Erro na importação.');
    } finally {
      setRunning(null);
    }
  };

  // ─── Importação manual via texto livre / CSV ─────────────
  const previewPaste = () => {
    const blocks = pasteText.split(/\n-{3,}\n|\n={3,}\n/).map(b => b.trim()).filter(Boolean);
    const list = blocks.length > 1 ? blocks : pasteText.split(/\n\n\n+/).map(b => b.trim()).filter(Boolean);
    const parsed = list.map(b => parseJobText(b, categories as any));
    setPastePreview(parsed);
    if (parsed.length === 0) toast.error('Nada detectado. Separe vagas com uma linha de "---".');
  };

  const importPaste = async () => {
    if (!pastePreview || pastePreview.length === 0) return;
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      let ok = 0, err = 0;
      for (const p of pastePreview) {
        if (!p.title) { err++; continue; }
        const { error } = await supabase.from('jobs').insert({
          user_id: user.id,
          title: p.title.slice(0, 200),
          description: p.description || p.title,
          opportunity_type: p.opportunity_type || 'emprego',
          city: p.city || '',
          state: p.state || '',
          neighborhood: p.neighborhood || '',
          contact_name: p.contact_name || '',
          contact_phone: p.contact_phone || '',
          whatsapp: p.whatsapp || '',
          status: 'active',
          approval_status: 'approved',
          job_type: p.job_type || '',
          work_model: p.work_model || '',
          activities: p.activities || '',
          requirements: p.requirements || '',
          benefits: p.benefits || '',
          schedule: p.schedule || '',
          salary: p.salary || '',
          category_id: p.category_id || null,
          subtitle: p.subtitle || '',
        });
        if (error) err++; else ok++;
      }
      await (supabase as any).from('job_import_log').insert({
        source_name: 'Importação manual (texto)',
        trigger_mode: 'paste',
        found_count: pastePreview.length,
        inserted_count: ok,
        error_count: err,
      });
      toast.success(`${ok} vagas criadas, ${err} com erro.`);
      setPasteText(''); setPastePreview(null);
      qc.invalidateQueries({ queryKey: ['job-import-logs'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="container py-6 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Rss className="h-6 w-6" /> Importação de Vagas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capte vagas automaticamente de feeds RSS confiáveis ou cole vagas manualmente em lote.
          </p>
        </div>

        <Tabs defaultValue="rss">
          <TabsList>
            <TabsTrigger value="rss"><Rss className="h-4 w-4 mr-1" /> Fontes RSS</TabsTrigger>
            <TabsTrigger value="paste"><FileText className="h-4 w-4 mr-1" /> Colar texto/CSV</TabsTrigger>
            <TabsTrigger value="logs">Histórico</TabsTrigger>
          </TabsList>

          {/* ─── ABA RSS ─── */}
          <TabsContent value="rss" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Adicionar nova fonte RSS</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input value={newSrc.name} onChange={e => setNewSrc({ ...newSrc, name: e.target.value })} placeholder="Ex: SINE Curitiba" />
                </div>
                <div className="space-y-1">
                  <Label>URL do feed *</Label>
                  <Input value={newSrc.feed_url} onChange={e => setNewSrc({ ...newSrc, feed_url: e.target.value })} placeholder="https://exemplo.com/vagas/feed" />
                </div>
                <div className="space-y-1">
                  <Label>Cidade padrão</Label>
                  <Input value={newSrc.default_city} onChange={e => setNewSrc({ ...newSrc, default_city: e.target.value })} placeholder="Curitiba" />
                </div>
                <div className="space-y-1">
                  <Label>UF padrão</Label>
                  <Input maxLength={2} value={newSrc.default_state} onChange={e => setNewSrc({ ...newSrc, default_state: e.target.value.toUpperCase() })} placeholder="PR" />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch checked={newSrc.is_trusted} onCheckedChange={v => setNewSrc({ ...newSrc, is_trusted: v })} />
                  <Label className="font-normal">Fonte confiável (vagas auto-aprovadas)</Label>
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={addSource}><Plus className="h-4 w-4 mr-1" /> Adicionar fonte</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Fontes cadastradas ({sources.length})</CardTitle>
                <Button size="sm" onClick={() => runImport()} disabled={running !== null}>
                  {running === 'all' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Rodar todas
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {sources.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fonte ainda.</p>}
                {sources.map((s: any) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium flex items-center gap-2">
                        {s.name}
                        {s.is_trusted && <Badge variant="default" className="text-[10px]">Confiável</Badge>}
                        {!s.is_active && <Badge variant="secondary" className="text-[10px]">Pausada</Badge>}
                      </div>
                      <a href={s.feed_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 truncate">
                        {s.feed_url} <ExternalLink className="h-3 w-3" />
                      </a>
                      {s.last_status && <div className="text-[11px] text-muted-foreground mt-0.5">Última: {s.last_status}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_active} onCheckedChange={v => toggleActive(s.id, v)} />
                      <span className="text-xs">Ativa</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_trusted} onCheckedChange={v => toggleTrusted(s.id, v)} />
                      <span className="text-xs">Confiável</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => runImport(s.id)} disabled={running !== null}>
                      {running === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteSource(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ABA COLAR TEXTO ─── */}
          <TabsContent value="paste" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Colar vagas em lote</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Cole o texto das vagas. Separe múltiplas vagas com uma linha contendo apenas <code>---</code>.
                  O sistema extrai automaticamente título, cidade, salário, contato etc.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="csv-upload" className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" /> Carregar arquivo CSV/TXT
                  </Label>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) { toast.error('Arquivo maior que 2MB.'); return; }
                      const text = await file.text();
                      // CSV → converte cada linha (após header) em bloco "Coluna: valor"
                      if (file.name.toLowerCase().endsWith('.csv')) {
                        const lines = text.split(/\r?\n/).filter(Boolean);
                        if (lines.length < 2) { toast.error('CSV vazio.'); return; }
                        const headers = lines[0].split(/[,;]/).map(h => h.trim());
                        const blocks = lines.slice(1).map(row => {
                          const cells = row.split(/[,;]/);
                          return headers.map((h, i) => `${h}: ${(cells[i] ?? '').trim()}`).join('\n');
                        });
                        setPasteText(blocks.join('\n\n---\n\n'));
                        toast.success(`${blocks.length} linhas carregadas do CSV. Clique em Pré-visualizar.`);
                      } else {
                        setPasteText(text);
                        toast.success('Arquivo carregado.');
                      }
                      e.target.value = '';
                    }}
                  />
                  <span className="text-[11px] text-muted-foreground">CSV deve ter cabeçalho na 1ª linha (ex: title,city,state,salary)</span>
                </div>
                <Textarea
                  rows={12}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={`Vaga: Auxiliar Administrativo\nLocal: Curitiba - PR\nSalário: R$ 1.800\nWhatsApp: 41 99999-9999\n\n---\n\nVaga: Pedreiro\nLocal: São José dos Pinhais - PR\n...`}
                />
                <div className="flex gap-2">
                  <Button onClick={previewPaste} disabled={!pasteText.trim()}>Pré-visualizar</Button>
                  {pastePreview && (
                    <Button onClick={importPaste} disabled={importing} variant="default">
                      {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Importar {pastePreview.length} vagas
                    </Button>
                  )}
                </div>

                {pastePreview && (
                  <div className="space-y-2 mt-3">
                    {pastePreview.map((p, i) => (
                      <div key={i} className="rounded border p-3 text-sm">
                        <div className="font-semibold">{p.title || <span className="text-destructive">Sem título</span>}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {[p.city, p.state].filter(Boolean).join(' / ')} · {p.opportunity_type} · {p.categoryName || 'Sem categoria'}
                        </div>
                        {p.detectedFields.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.detectedFields.map((f: string, k: number) => (
                              <Badge key={k} variant="secondary" className="text-[10px]">{f}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ABA HISTÓRICO ─── */}
          <TabsContent value="logs" className="space-y-2">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>}
            {logs.map((l: any) => (
              <Card key={l.id}>
                <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      {l.source_name || '—'}
                      <Badge variant="outline" className="text-[10px]">{l.trigger_mode}</Badge>
                      {l.error_count > 0 && l.inserted_count === 0 && <Badge variant="destructive" className="text-[10px]">Falhou</Badge>}
                      {l.inserted_count > 0 && <Badge variant="default" className="text-[10px]">OK</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="flex gap-3 text-xs items-center flex-wrap">
                    <span>Encontradas: <b>{l.found_count}</b></span>
                    <span className="text-green-600">Aprovadas/Novas: <b>{l.inserted_count}</b></span>
                    <span className="text-amber-600">Duplicadas/Pendentes: <b>{l.duplicate_count}</b></span>
                    {l.error_count > 0 && <span className="text-destructive">Erros: <b>{l.error_count}</b></span>}
                    {l.source_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runImport(l.source_id)}
                        disabled={running !== null}
                      >
                        {running === l.source_id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                        Reprocessar
                      </Button>
                    )}
                  </div>
                  {l.error_message && <div className="w-full text-xs text-destructive">{l.error_message}</div>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
