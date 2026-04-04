import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Eye, EyeOff, Search, Image as ImageIcon, RefreshCw, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';

const ENTITY_TYPES = ['all', 'profile', 'service', 'provider', 'banner', 'sponsor', 'portfolio', 'generic'];
const MIME_TYPES = ['all', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const STATUS_OPTIONS = ['all', 'active', 'inactive'];
const PER_PAGE = 100;

const formatSize = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

const AdminMediaPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [mimeFilter, setMimeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, totalSize: 0, oversized: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [oversizedFiles, setOversizedFiles] = useState<any[]>([]);
  const [showOversized, setShowOversized] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('media')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

    if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);
    if (mimeFilter !== 'all') query = query.eq('mime_type', mimeFilter);
    if (statusFilter === 'active') query = query.eq('is_active', true);
    else if (statusFilter === 'inactive') query = query.eq('is_active', false);
    if (search.trim()) {
      query = query.or(`original_name.ilike.%${search}%,public_url.ilike.%${search}%,user_ref.ilike.%${search}%,hash.ilike.%${search}%,entity_ref.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) toast.error('Erro ao carregar mídia: ' + error.message);
    else { setMedia(data || []); setTotal(count || 0); }
    setLoading(false);
  }, [page, entityFilter, mimeFilter, statusFilter, search]);

  const fetchStats = async () => {
    const { data } = await supabase.from('media').select('is_active, size_original, size_optimized');
    if (data) {
      const oversized = data.filter((m: any) => (m.size_original || 0) > 1048576);
      setStats({
        total: data.length,
        active: data.filter((m: any) => m.is_active).length,
        totalSize: data.reduce((acc: number, m: any) => acc + ((m.size_optimized || m.size_original || 0) as number), 0),
        oversized: oversized.length,
      });
    }
  };

  useEffect(() => {
    if (isAdmin) { fetchMedia(); fetchStats(); }
  }, [isAdmin, page, entityFilter, mimeFilter, statusFilter]);

  const handleSearch = () => { setPage(1); fetchMedia(); };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === media.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(media.map(m => m.id)));
  };

  const bulkSetActive = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    await supabase.from('media').update({ is_active: active }).in('id', ids);
    await logAuditAction({ action: 'bulk_update', resource_type: 'media', details: { count: ids.length, is_active: active } });
    toast.success(`${ids.length} item(ns) ${active ? 'ativado(s)' : 'desativado(s)'}`);
    setSelectedIds(new Set());
    fetchMedia(); fetchStats();
    setBulkLoading(false);
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir permanentemente ${selectedIds.size} item(ns)?`)) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const toDelete = media.filter(m => ids.includes(m.id));
    for (const item of toDelete) {
      if (item.storage_path) {
        const bucketMatch = item.storage_path.match(/^([^/]+)\//);
        if (bucketMatch) {
          const bucket = bucketMatch[1];
          const path = item.storage_path.replace(`${bucket}/`, '');
          await supabase.storage.from(bucket).remove([path]);
        }
      }
    }
    await supabase.from('media').delete().in('id', ids);
    await logAuditAction({ action: 'bulk_delete', resource_type: 'media', details: { count: ids.length } });
    toast.success(`${ids.length} item(ns) excluído(s)`);
    setSelectedIds(new Set());
    fetchMedia(); fetchStats();
    setBulkLoading(false);
  };

  const bulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setZipLoading(true);
    try {
      const selected = media.filter(m => selectedIds.has(m.id) && m.public_url);
      if (selected.length === 0) { toast.error('Nenhum arquivo com URL válida'); return; }

      // Download files individually and trigger browser downloads
      for (const item of selected) {
        try {
          const response = await fetch(item.public_url);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = item.original_name || `media-${item.id}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          // Small delay to avoid browser blocking multiple downloads
          await new Promise(r => setTimeout(r, 300));
        } catch {
          console.warn('Failed to download:', item.original_name);
        }
      }
      toast.success(`${selected.length} arquivo(s) baixado(s)`);
    } catch (err) {
      toast.error('Erro no download');
    } finally {
      setZipLoading(false);
    }
  };

  const toggleActive = async (item: any) => {
    const newStatus = !item.is_active;
    await supabase.from('media').update({ is_active: newStatus }).eq('id', item.id);
    await logAuditAction({ action: 'update', resource_type: 'media', resource_id: item.id, details: { field: 'is_active', previous: item.is_active, new: newStatus } });
    toast.success(newStatus ? 'Mídia ativada' : 'Mídia desativada');
    fetchMedia(); fetchStats();
  };

  const handleDelete = async (item: any) => {
    if (!confirm('Excluir permanentemente esta mídia?')) return;
    if (item.storage_path) {
      const bucketMatch = item.storage_path.match(/^([^/]+)\//);
      if (bucketMatch) {
        const bucket = bucketMatch[1];
        const path = item.storage_path.replace(`${bucket}/`, '');
        await supabase.storage.from(bucket).remove([path]);
      }
    }
    await supabase.from('media').delete().eq('id', item.id);
    await logAuditAction({ action: 'delete', resource_type: 'media', resource_id: item.id, details: { original_name: item.original_name, entity_type: item.entity_type } });
    toast.success('Mídia excluída');
    fetchMedia(); fetchStats();
  };

  const scanOversized = async () => {
    setScanLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-optimize-images');
      if (error) throw error;
      setOversizedFiles(data?.files || []);
      setShowOversized(true);
      toast.success(`${data?.oversized_count || 0} arquivo(s) acima de ${data?.threshold_kb || 200}KB encontrado(s)`);
    } catch (err: any) {
      toast.error('Erro ao escanear: ' + (err.message || ''));
    } finally {
      setScanLoading(false);
    }
  };

  const compressSingle = async (bucket: string, filePath: string) => {
    try {
      const { error } = await supabase.functions.invoke('optimize-image', {
        body: { bucket, path: filePath },
      });
      if (error) throw error;
      toast.success('Imagem otimizada com sucesso');
      scanOversized(); // refresh list
    } catch (err: any) {
      toast.error('Erro ao comprimir: ' + (err.message || ''));
    }
  };

  if (adminLoading || !isAdmin) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const totalPages = Math.ceil(total / PER_PAGE);
  const hasSelection = selectedIds.size > 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Mídia</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as imagens e arquivos do sistema</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-foreground">{stats.total}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ativas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">{stats.active}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tamanho Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-foreground">{formatSize(stats.totalSize)}</p></CardContent></Card>
          <Card className="cursor-pointer hover:border-accent/50 transition-colors" onClick={scanOversized}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Acima de 200KB</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{stats.oversized}</p>
              <p className="text-[10px] text-muted-foreground">Clique para escanear storage</p>
            </CardContent>
          </Card>
        </div>

        {/* Compression Scanner */}
        {showOversized && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Arquivos Grandes no Storage ({oversizedFiles.length})
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowOversized(false)}>Fechar</Button>
              </div>
            </CardHeader>
            <CardContent>
              {scanLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Escaneando storage...</div>
              ) : oversizedFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum arquivo grande encontrado ✓</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {oversizedFiles.map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-xs font-medium">{f.file}</p>
                        <p className="text-[10px] text-muted-foreground">Bucket: {f.bucket} · {f.sizeKB} KB</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => compressSingle(f.bucket, f.file)} className="shrink-0 ml-2">
                        Comprimir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Buscar por nome, hash, entity_ref, URL..." className="pl-9" />
            </div>
          </div>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'Todos tipos' : t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={mimeFilter} onValueChange={(v) => { setMimeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MIME_TYPES.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'Todos formatos' : t.split('/')[1]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'Todos status' : t === 'active' ? 'Ativas' : 'Inativas'}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { fetchMedia(); fetchStats(); }}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={scanOversized} disabled={scanLoading}>
            {scanLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-1 h-4 w-4" />} Escanear
          </Button>
        </div>

        {/* Bulk Actions */}
        {hasSelection && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <span className="text-sm font-medium text-foreground">{selectedIds.size} selecionado(s)</span>
            <Button size="sm" variant="outline" onClick={() => bulkSetActive(true)} disabled={bulkLoading}><Eye className="mr-1 h-3.5 w-3.5" /> Ativar</Button>
            <Button size="sm" variant="outline" onClick={() => bulkSetActive(false)} disabled={bulkLoading}><EyeOff className="mr-1 h-3.5 w-3.5" /> Desativar</Button>
            <Button size="sm" variant="outline" onClick={bulkDownload} disabled={zipLoading}>
              {zipLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />} Download
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={bulkLoading}><Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
          </div>
        )}

        {/* Select all toggle */}
        <div className="flex items-center gap-2">
          <Checkbox checked={media.length > 0 && selectedIds.size === media.length} onCheckedChange={selectAll} />
          <span className="text-xs text-muted-foreground">Selecionar todos da página</span>
          <span className="ml-auto text-xs text-muted-foreground">{total} resultado(s)</span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : media.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-foreground font-semibold">Nenhuma mídia encontrada</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {media.map((item: any) => (
                <div key={item.id} className={`group relative rounded-lg border overflow-hidden ${selectedIds.has(item.id) ? 'ring-2 ring-accent' : ''} ${item.is_active ? 'border-border' : 'border-destructive/30 opacity-60'}`}>
                  <div className="absolute top-1 left-1 z-10">
                    <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelection(item.id)} className="bg-background/80" />
                  </div>
                  <div className="aspect-square bg-muted">
                    {item.public_url ? (
                      <img src={item.public_url} alt={item.original_name || 'Mídia'} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => toggleActive(item)} title={item.is_active ? 'Desativar' : 'Ativar'}>
                        {item.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      {item.public_url && (
                        <Button variant="secondary" size="sm" className="h-7 w-7 p-0" asChild>
                          <a href={item.public_url} download={item.original_name} target="_blank" rel="noopener noreferrer" title="Download"><Download className="h-3 w-3" /></a>
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(item)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-white text-center truncate w-full mt-1">{item.original_name || '—'}</p>
                    {item.width && item.height && (
                      <p className="text-[9px] text-white/70">{item.width}×{item.height}</p>
                    )}
                    <p className="text-[9px] text-white/70">{formatSize(item.size_original)}</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <p className="text-[10px] font-medium text-foreground truncate">{item.original_name || 'Sem nome'}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[8px] px-1 py-0">{item.entity_type}</Badge>
                      <span className="text-[8px] text-muted-foreground">{formatSize(item.size_optimized || item.size_original)}</span>
                      <span className="text-[8px] text-muted-foreground">{item.mime_type?.split('/')[1]}</span>
                    </div>
                    {item.user_ref && <p className="text-[8px] text-muted-foreground truncate">ref: {item.user_ref}</p>}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && <PaginationControls currentPage={page} totalItems={total} itemsPerPage={PER_PAGE} onPageChange={setPage} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMediaPage;
