import { useState, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import {
  ShieldCheck, ShieldAlert, Database, FileImage, Zap, Download, RefreshCw,
  CheckCircle2, XCircle, Info, Loader2
} from 'lucide-react';

interface AuditRow { table_name: string; total_records: number; invalid_refs: number }
interface MediaRow {
  id: string; original_name: string; storage_path: string; user_ref: string | null;
  entity_type: string; is_active: boolean; mime_type: string;
}

const SPECIAL_REFS = ['unlinked', 'sponsors', 'settings'];
const BUCKET_FILTERS = ['Todos', 'Avatars', 'Service Images', 'Portfolio', 'Sponsors', 'Inválidos'] as const;

const TRIGGERS_INFO = [
  { name: 'set_user_ref', table: 'profiles', fn: 'set_user_ref()', desc: 'Gera user_ref único no formato curto xxxx-xxxx-xxxx-xxxx ao criar perfil.' },
  { name: 'trg_copy_user_ref_providers', table: 'providers', fn: 'copy_user_ref_from_profile()', desc: 'Herda user_ref do profile vinculado via user_id.' },
  { name: 'trg_copy_user_ref_services', table: 'services', fn: 'copy_user_ref_from_profile()', desc: 'Herda user_ref do profile vinculado via user_id do provider.' },
  { name: 'trg_set_user_ref_media', table: 'media', fn: 'set_media_user_ref_from_path()', desc: 'Extrai UUID do storage_path e converte para user_ref curto via profiles.' },
  { name: 'trg_prevent_user_ref_update', table: 'providers', fn: 'prevent_user_ref_update()', desc: 'Impede alteração de user_ref após criação (imutabilidade).' },
  { name: 'trg_prevent_user_ref_update_media', table: 'media', fn: 'prevent_user_ref_update()', desc: 'Impede alteração de user_ref após criação (imutabilidade).' },
];

const FLOW_STEPS = [
  { step: 1, label: 'Perfil', desc: 'Gera user_ref único ao criar conta.' },
  { step: 2, label: 'Provider', desc: 'Herda user_ref do profile via trigger.' },
  { step: 3, label: 'Service', desc: 'Herda user_ref do provider/profile via trigger.' },
  { step: 4, label: 'Media', desc: 'Extrai UUID do storage_path → converte para user_ref curto.' },
  { step: 5, label: 'Proteção', desc: 'user_ref imutável após criação (triggers de prevenção).' },
  { step: 6, label: 'RLS', desc: 'Policies comparam media.user_ref com profiles.user_ref via auth.uid().' },
];

function getBucket(path: string) {
  return path?.split('/')[0] || 'unknown';
}

export default function AdminAuditRefPage() {
  const [tab, setTab] = useState('tabelas');
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [profileRefs, setProfileRefs] = useState<Set<string>>(new Set());
  const [bucketFilter, setBucketFilter] = useState<string>('Todos');
  const [inspectItem, setInspectItem] = useState<MediaRow | null>(null);
  const { logAction } = useAuditLog();

  const runAudit = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch audit_user_ref_full()
      const { data: auditData, error: auditErr } = await supabase.rpc('audit_user_ref_full' as any);
      if (auditErr) throw auditErr;
      setAuditRows((auditData as any[]) || []);

      // Fetch media (limit 500)
      const { data: mediaData, error: mediaErr } = await supabase
        .from('media')
        .select('id, original_name, storage_path, user_ref, entity_type, is_active, mime_type')
        .limit(500);
      if (mediaErr) throw mediaErr;
      setMediaRows((mediaData as MediaRow[]) || []);

      // Fetch all profile user_refs for validation
      const { data: profiles } = await supabase.from('profiles').select('user_ref');
      setProfileRefs(new Set((profiles || []).map((p: any) => p.user_ref).filter(Boolean)));

      const now = new Date().toLocaleString('pt-BR');
      setLastRun(now);

      const totalInvalid = ((auditData as any[]) || []).reduce((s: number, r: any) => s + Number(r.invalid_refs || 0), 0);
      const mediaInvalid = (mediaData || []).filter((m: any) => {
        if (!m.user_ref) return true;
        if (SPECIAL_REFS.includes(m.user_ref)) return false;
        return !(profiles || []).some((p: any) => p.user_ref === m.user_ref);
      }).length;

      await logAction({
        action: 'export' as any,
        resource_type: 'audit_user_ref',
        details: {
          tables: (auditData as any[])?.length || 0,
          media_total: mediaData?.length || 0,
          media_invalid: mediaInvalid,
          table_invalid: totalInvalid,
          timestamp: now,
        },
      });

      toast.success('Auditoria concluída');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [logAction]);

  const isMediaValid = (m: MediaRow) => {
    if (!m.user_ref) return false;
    if (SPECIAL_REFS.includes(m.user_ref)) return true;
    return profileRefs.has(m.user_ref);
  };

  const filteredMedia = mediaRows.filter((m) => {
    const bucket = getBucket(m.storage_path);
    if (bucketFilter === 'Inválidos') return !isMediaValid(m);
    if (bucketFilter === 'Avatars') return bucket === 'avatars';
    if (bucketFilter === 'Service Images') return bucket === 'service-images';
    if (bucketFilter === 'Portfolio') return bucket === 'portfolio';
    if (bucketFilter === 'Sponsors') return bucket === 'sponsors';
    return true;
  });

  const displayMedia = filteredMedia.slice(0, 100);

  const totalRecords = auditRows.reduce((s, r) => s + Number(r.total_records || 0), 0);
  const totalInvalid = auditRows.reduce((s, r) => s + Number(r.invalid_refs || 0), 0);
  const mediaInvalid = mediaRows.filter((m) => !isMediaValid(m)).length;

  const exportCsv = () => {
    const lines: string[] = ['Seção,Tabela,Total,Inválidos,Status'];
    auditRows.forEach((r) => {
      lines.push(`Tabelas,${r.table_name},${r.total_records},${r.invalid_refs},${r.invalid_refs > 0 ? 'INVALID' : 'OK'}`);
    });
    lines.push('');
    lines.push('Seção,Arquivo,Bucket,user_ref,Tipo,Válido');
    mediaRows.forEach((m) => {
      lines.push(`Mídia,"${m.original_name}",${getBucket(m.storage_path)},${m.user_ref || ''},${m.entity_type},${isMediaValid(m) ? 'Sim' : 'Não'}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date().toISOString().split('T')[0];
    a.download = `auditoria-user-ref-${d}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Auditoria de user_ref</h1>
          {lastRun && <p className="text-xs text-muted-foreground">Última execução: {lastRun}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={runAudit} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Executar Auditoria
          </Button>
          <Button onClick={exportCsv} disabled={!auditRows.length} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Database className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Total Registros</p><p className="text-lg font-bold">{totalRecords}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          {totalInvalid > 0 ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-green-600" />}
          <div><p className="text-xs text-muted-foreground">Inválidos (Tabelas)</p><p className="text-lg font-bold">{totalInvalid}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <FileImage className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Arquivos Mídia</p><p className="text-lg font-bold">{mediaRows.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          {mediaInvalid > 0 ? <XCircle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
          <div><p className="text-xs text-muted-foreground">Mídia sem Vínculo</p><p className="text-lg font-bold">{mediaInvalid}</p></div>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tabelas"><Database className="h-3.5 w-3.5 mr-1" />Tabelas</TabsTrigger>
          <TabsTrigger value="midia"><FileImage className="h-3.5 w-3.5 mr-1" />Mídia</TabsTrigger>
          <TabsTrigger value="triggers"><Zap className="h-3.5 w-3.5 mr-1" />Triggers</TabsTrigger>
        </TabsList>

        {/* TAB: Tabelas */}
        <TabsContent value="tabelas">
          {auditRows.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Clique em "Executar Auditoria" para iniciar a verificação.
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Inválidos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.map((r) => (
                    <TableRow key={r.table_name} className={r.invalid_refs > 0 ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-mono text-sm">{r.table_name}</TableCell>
                      <TableCell className="text-right">{r.total_records}</TableCell>
                      <TableCell className="text-right font-semibold">{r.invalid_refs}</TableCell>
                      <TableCell>
                        {r.invalid_refs > 0 ? (
                          <Badge variant="destructive" className="text-[10px]">INVALID</Badge>
                        ) : (
                          <Badge className="bg-green-600 text-[10px]">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Mídia */}
        <TabsContent value="midia" className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {BUCKET_FILTERS.map((f) => (
              <Button key={f} size="sm" variant={bucketFilter === f ? 'default' : 'outline'}
                className="text-xs h-7" onClick={() => setBucketFilter(f)}>
                {f} {f !== 'Todos' && f !== 'Inválidos' ? '' : ''}
              </Button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground self-center">
              {filteredMedia.length} itens {filteredMedia.length > 100 && '(exibindo 100, exporte CSV para ver todos)'}
            </span>
          </div>

          {displayMedia.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              {mediaRows.length === 0 ? 'Execute a auditoria primeiro.' : 'Nenhum item encontrado com este filtro.'}
            </CardContent></Card>
          ) : (
            <Card>
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">✓</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Bucket</TableHead>
                      <TableHead>user_ref</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayMedia.map((m) => {
                      const valid = isMediaValid(m);
                      return (
                        <TableRow key={m.id} className={!valid ? 'bg-destructive/5' : ''}>
                          <TableCell>
                            {valid ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          </TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate" title={m.original_name}>{m.original_name}</TableCell>
                          <TableCell className="text-xs font-mono">{getBucket(m.storage_path)}</TableCell>
                          <TableCell className="text-xs font-mono">{m.user_ref || '—'}</TableCell>
                          <TableCell className="text-xs">{m.entity_type}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setInspectItem(m)}>
                              <Info className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Triggers */}
        <TabsContent value="triggers" className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Triggers Ativos de user_ref</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TRIGGERS_INFO.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="font-mono text-xs">{t.name}</TableCell>
                      <TableCell className="text-xs">{t.table}</TableCell>
                      <TableCell className="font-mono text-xs">{t.fn}</TableCell>
                      <TableCell className="text-xs max-w-[250px]">{t.desc}</TableCell>
                      <TableCell><Badge className="bg-green-600 text-[10px]">Ativo</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Fluxo de Consistência</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {FLOW_STEPS.map((s) => (
                  <li key={s.step} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold mt-0.5">
                      {s.step}
                    </span>
                    <div>
                      <span className="font-semibold text-sm">{s.label}:</span>{' '}
                      <span className="text-sm text-muted-foreground">{s.desc}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Inspect Dialog */}
      <Dialog open={!!inspectItem} onOpenChange={() => setInspectItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da Mídia</DialogTitle></DialogHeader>
          {inspectItem && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span className="font-semibold text-muted-foreground">ID:</span>
                <span className="font-mono text-xs break-all">{inspectItem.id}</span>
                <span className="font-semibold text-muted-foreground">Arquivo:</span>
                <span className="break-all">{inspectItem.original_name}</span>
                <span className="font-semibold text-muted-foreground">Storage Path:</span>
                <span className="font-mono text-xs break-all">{inspectItem.storage_path}</span>
                <span className="font-semibold text-muted-foreground">Bucket:</span>
                <span>{getBucket(inspectItem.storage_path)}</span>
                <span className="font-semibold text-muted-foreground">user_ref:</span>
                <span className="font-mono">{inspectItem.user_ref || '—'}</span>
                <span className="font-semibold text-muted-foreground">Tipo:</span>
                <span>{inspectItem.entity_type}</span>
                <span className="font-semibold text-muted-foreground">MIME:</span>
                <span>{inspectItem.mime_type}</span>
                <span className="font-semibold text-muted-foreground">Ativo:</span>
                <span>{inspectItem.is_active ? 'Sim' : 'Não'}</span>
                <span className="font-semibold text-muted-foreground">Status:</span>
                <span>
                  {isMediaValid(inspectItem) ? (
                    <Badge className="bg-green-600 text-[10px]">Válido</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">Inválido</Badge>
                  )}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
