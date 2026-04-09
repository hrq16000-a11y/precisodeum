import { useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import { Shield, Play, Download, AlertTriangle, CheckCircle2, Database, Image as ImageIcon, Loader2, RefreshCw, FileText, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AuditRow = { table_name: string; total_records: number; invalid_refs: number };
type MediaRow = {
  id: string;
  original_name: string;
  storage_path: string;
  user_ref: string | null;
  entity_type: string;
  is_valid: boolean;
};

const AdminUserRefAuditPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [auditResults, setAuditResults] = useState<AuditRow[]>([]);
  const [mediaResults, setMediaResults] = useState<MediaRow[]>([]);
  const [running, setRunning] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<string>('all');
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [inspectItem, setInspectItem] = useState<MediaRow | null>(null);

  const runAudit = useCallback(async () => {
    setRunning(true);
    try {
      // 1. Run the DB audit function
      const { data: auditData, error: auditErr } = await supabase.rpc('audit_user_ref_full' as any);
      if (auditErr) throw auditErr;
      setAuditResults((auditData as any[]) || []);

      // 2. Fetch media with validation
      const { data: allMedia, error: mediaErr } = await supabase
        .from('media')
        .select('id, original_name, storage_path, user_ref, entity_type')
        .order('created_at', { ascending: false })
        .limit(500);
      if (mediaErr) throw mediaErr;

      // 3. Fetch all valid user_refs from profiles
      const { data: profiles } = await supabase.from('profiles').select('user_ref');
      const validRefs = new Set((profiles || []).map((p: any) => p.user_ref));
      const specialRefs = new Set(['unlinked', 'sponsors', 'settings']);

      const enriched: MediaRow[] = (allMedia || []).map((m: any) => ({
        ...m,
        is_valid: !!(m.user_ref && (validRefs.has(m.user_ref) || specialRefs.has(m.user_ref))),
      }));
      setMediaResults(enriched);

      const now = new Date().toLocaleString('pt-BR');
      setLastRun(now);

      // Log audit action
      await logAuditAction({
        action: 'audit_user_ref',
        resource_type: 'system',
        details: {
          tables: (auditData as any[])?.map((r: any) => ({ table: r.table_name, total: r.total_records, invalid: r.invalid_refs })),
          media_total: enriched.length,
          media_invalid: enriched.filter(m => !m.is_valid).length,
          ran_at: now,
        },
      });

      toast.success('Auditoria concluída com sucesso');
    } catch (err: any) {
      toast.error('Erro na auditoria: ' + err.message);
    } finally {
      setRunning(false);
    }
  }, []);

  const exportCSV = useCallback(() => {
    if (!auditResults.length && !mediaResults.length) {
      toast.error('Execute a auditoria primeiro');
      return;
    }

    let csv = 'Seção,Tabela,Total,Inválidos,Status\n';
    auditResults.forEach(r => {
      csv += `Tabelas,${r.table_name},${r.total_records},${r.invalid_refs},${r.invalid_refs === 0 ? 'OK' : 'INVALID'}\n`;
    });

    csv += '\nID,Arquivo,Path,UserRef,Tipo,Válido\n';
    mediaResults.forEach(m => {
      csv += `${m.id},"${m.original_name}","${m.storage_path}",${m.user_ref || ''},${m.entity_type},${m.is_valid ? 'OK' : 'INVALID'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-user-ref-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  }, [auditResults, mediaResults]);

  const getBucketFromPath = (path: string) => {
    const first = path.split('/')[0];
    if (['avatars', 'service-images', 'portfolio', 'sponsors'].includes(first)) return first;
    return 'generic';
  };

  const filteredMedia = mediaFilter === 'all'
    ? mediaResults
    : mediaFilter === 'invalid'
      ? mediaResults.filter(m => !m.is_valid)
      : mediaResults.filter(m => getBucketFromPath(m.storage_path) === mediaFilter);

  if (adminLoading || !isAdmin) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const totalInvalid = auditResults.reduce((s, r) => s + r.invalid_refs, 0);
  const mediaInvalid = mediaResults.filter(m => !m.is_valid).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-accent" />
              Auditoria de user_ref
            </h1>
            <p className="text-sm text-muted-foreground">Validação de integridade entre tabelas, mídia e storage</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={runAudit} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Executar Auditoria
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={!auditResults.length} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        </div>

        {lastRun && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Última execução: {lastRun}
          </p>
        )}

        {/* Summary Cards */}
        {auditResults.length > 0 && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <Database className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold">{auditResults.reduce((s, r) => s + r.total_records, 0)}</p>
                <p className="text-[10px] text-muted-foreground">Total Registros</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                {totalInvalid === 0 ? (
                  <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                ) : (
                  <AlertTriangle className="h-5 w-5 mx-auto text-destructive mb-1" />
                )}
                <p className="text-2xl font-bold">{totalInvalid}</p>
                <p className="text-[10px] text-muted-foreground">Refs Inválidas (tabelas)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <ImageIcon className="h-5 w-5 mx-auto text-accent mb-1" />
                <p className="text-2xl font-bold">{mediaResults.length}</p>
                <p className="text-[10px] text-muted-foreground">Arquivos de Mídia</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                {mediaInvalid === 0 ? (
                  <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                ) : (
                  <AlertTriangle className="h-5 w-5 mx-auto text-destructive mb-1" />
                )}
                <p className="text-2xl font-bold">{mediaInvalid}</p>
                <p className="text-[10px] text-muted-foreground">Mídia sem vínculo</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="tables" className="w-full">
          <TabsList>
            <TabsTrigger value="tables" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Tabelas</TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Mídia</TabsTrigger>
            <TabsTrigger value="triggers" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Triggers</TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables" className="mt-4">
            {auditResults.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Clique em "Executar Auditoria" para verificar a integridade</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Resultado por Tabela</CardTitle>
                  <CardDescription className="text-xs">Validação de user_ref em cada tabela principal</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tabela</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Inválidos</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditResults.map(r => (
                        <TableRow key={r.table_name} className={r.invalid_refs > 0 ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-mono text-xs">{r.table_name}</TableCell>
                          <TableCell className="text-right font-medium">{r.total_records}</TableCell>
                          <TableCell className="text-right font-medium">{r.invalid_refs}</TableCell>
                          <TableCell className="text-right">
                            {r.invalid_refs === 0 ? (
                              <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 text-[10px]">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                <AlertTriangle className="h-3 w-3 mr-1" /> INVALID
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Select value={mediaFilter} onValueChange={setMediaFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({mediaResults.length})</SelectItem>
                  <SelectItem value="invalid">Inválidos ({mediaInvalid})</SelectItem>
                  <SelectItem value="avatars">Avatars</SelectItem>
                  <SelectItem value="service-images">Service Images</SelectItem>
                  <SelectItem value="portfolio">Portfolio</SelectItem>
                  <SelectItem value="sponsors">Sponsors</SelectItem>
                  <SelectItem value="generic">Outros</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{filteredMedia.length} registros</span>
            </div>

            {filteredMedia.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>{mediaResults.length === 0 ? 'Execute a auditoria primeiro' : 'Nenhum resultado para este filtro'}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">Status</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Bucket</TableHead>
                          <TableHead>user_ref</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMedia.slice(0, 100).map(m => (
                          <TableRow key={m.id} className={!m.is_valid ? 'bg-destructive/5' : ''}>
                            <TableCell>
                              {m.is_valid ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs max-w-[200px] truncate" title={m.original_name}>
                              {m.original_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">{getBucketFromPath(m.storage_path)}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{m.user_ref || <span className="text-destructive">NULL</span>}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.entity_type}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setInspectItem(m)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {filteredMedia.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Mostrando 100 de {filteredMedia.length} — exporte CSV para ver todos</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Triggers Tab */}
          <TabsContent value="triggers" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Triggers Ativos de user_ref</CardTitle>
                <CardDescription className="text-xs">Mecanismos automáticos de preenchimento e proteção</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    table: 'profiles',
                    trigger: 'set_user_ref',
                    fn: 'set_user_ref()',
                    desc: 'Gera user_ref curto (xxxx-xxxx-xxxx-xxxx) ao criar perfil',
                    status: 'active',
                  },
                  {
                    table: 'providers',
                    trigger: 'trg_copy_user_ref_providers',
                    fn: 'copy_user_ref_from_profile()',
                    desc: 'Herda user_ref do profile via user_id — sem geração aleatória',
                    status: 'active',
                  },
                  {
                    table: 'services',
                    trigger: 'trg_copy_user_ref_services',
                    fn: 'copy_user_ref_from_profile()',
                    desc: 'Herda user_ref do profile via provider → user_id',
                    status: 'active',
                  },
                  {
                    table: 'media',
                    trigger: 'trg_set_user_ref_media',
                    fn: 'set_media_user_ref_from_path()',
                    desc: 'Extrai UUID da pasta no storage_path e converte para user_ref curto',
                    status: 'active',
                  },
                  {
                    table: 'providers',
                    trigger: 'trg_prevent_user_ref_update',
                    fn: 'prevent_user_ref_update()',
                    desc: 'Impede alteração de user_ref após criação (imutabilidade)',
                    status: 'active',
                  },
                  {
                    table: 'media',
                    trigger: 'trg_prevent_user_ref_update_media',
                    fn: 'prevent_user_ref_update()',
                    desc: 'Impede alteração de user_ref em registros de mídia',
                    status: 'active',
                  },
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] font-mono">{t.table}</Badge>
                        <span className="font-mono text-xs text-foreground">{t.trigger}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
                      <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">→ {t.fn}</p>
                    </div>
                    <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 text-[10px] shrink-0">Ativo</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fluxo de Consistência</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>1. <strong>Cadastro:</strong> Novo perfil recebe user_ref único (set_user_ref)</p>
                <p>2. <strong>Provider:</strong> Herda user_ref do perfil automaticamente (copy_user_ref_from_profile)</p>
                <p>3. <strong>Service:</strong> Herda user_ref do perfil via provider (copy_user_ref_from_profile)</p>
                <p>4. <strong>Mídia:</strong> Extrai UUID do storage_path e converte para user_ref curto (set_media_user_ref_from_path)</p>
                <p>5. <strong>Proteção:</strong> user_ref é imutável após criação (prevent_user_ref_update)</p>
                <p>6. <strong>RLS:</strong> Políticas de segurança comparam user_ref do registro com profiles.user_ref do auth.uid()</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Inspect Dialog */}
        <Dialog open={!!inspectItem} onOpenChange={() => setInspectItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Detalhes do Arquivo</DialogTitle>
            </DialogHeader>
            {inspectItem && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono break-all">{inspectItem.id}</span>
                  <span className="text-muted-foreground">Arquivo:</span>
                  <span className="font-mono break-all">{inspectItem.original_name}</span>
                  <span className="text-muted-foreground">Storage Path:</span>
                  <span className="font-mono break-all">{inspectItem.storage_path}</span>
                  <span className="text-muted-foreground">user_ref:</span>
                  <span className="font-mono">{inspectItem.user_ref || <span className="text-destructive">NULL</span>}</span>
                  <span className="text-muted-foreground">Tipo:</span>
                  <span>{inspectItem.entity_type}</span>
                  <span className="text-muted-foreground">Bucket:</span>
                  <Badge variant="secondary" className="w-fit text-[10px]">{getBucketFromPath(inspectItem.storage_path)}</Badge>
                  <span className="text-muted-foreground">Status:</span>
                  {inspectItem.is_valid ? (
                    <Badge variant="default" className="w-fit bg-emerald-500/15 text-emerald-600 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Válido
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="w-fit text-[10px]">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Inválido
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUserRefAuditPage;
