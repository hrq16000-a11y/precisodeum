import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Eye, EyeOff, Search, Image as ImageIcon, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';

const ENTITY_TYPES = ['all', 'profile', 'service', 'provider', 'banner', 'sponsor', 'generic'];
const PER_PAGE = 24;

const AdminMediaPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, totalSize: 0 });

  const fetchMedia = async () => {
    setLoading(true);
    let query = supabase
      .from('media' as any)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

    if (entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter);
    }
    if (search.trim()) {
      query = query.or(`original_name.ilike.%${search}%,public_url.ilike.%${search}%,user_ref.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) {
      toast.error('Erro ao carregar mídia: ' + error.message);
    } else {
      setMedia(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const { data } = await supabase
      .from('media' as any)
      .select('is_active, size_original, size_optimized');
    
    if (data) {
      setStats({
        total: data.length,
        active: data.filter((m: any) => m.is_active).length,
        totalSize: data.reduce((acc: number, m: any) => acc + ((m.size_optimized || m.size_original || 0) as number), 0),
      });
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchMedia();
      fetchStats();
    }
  }, [isAdmin, page, entityFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchMedia();
  };

  const toggleActive = async (item: any) => {
    const newStatus = !item.is_active;
    await supabase.from('media' as any).update({ is_active: newStatus }).eq('id', item.id);
    await logAuditAction({
      action: 'update',
      resource_type: 'media',
      resource_id: item.id,
      details: { field: 'is_active', previous: item.is_active, new: newStatus },
    });
    toast.success(newStatus ? 'Mídia ativada' : 'Mídia desativada');
    fetchMedia();
    fetchStats();
  };

  const handleDelete = async (item: any) => {
    if (!confirm('Excluir permanentemente esta mídia?')) return;
    
    // Delete from storage if path exists
    if (item.storage_path) {
      const bucketMatch = item.storage_path.match(/^([^/]+)\//);
      if (bucketMatch) {
        const bucket = bucketMatch[1];
        const path = item.storage_path.replace(`${bucket}/`, '');
        await supabase.storage.from(bucket).remove([path]);
      }
    }

    await supabase.from('media' as any).delete().eq('id', item.id);
    await logAuditAction({
      action: 'delete',
      resource_type: 'media',
      resource_id: item.id,
      details: { original_name: item.original_name, entity_type: item.entity_type },
    });
    toast.success('Mídia excluída');
    fetchMedia();
    fetchStats();
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  if (adminLoading || !isAdmin) {
    return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;
  }

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Mídia</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as imagens e arquivos do sistema</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-foreground">{stats.total}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ativas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{stats.active}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tamanho Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-foreground">{formatSize(stats.totalSize)}</p></CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar por nome, URL ou user_ref..."
                className="pl-9"
              />
            </div>
          </div>
          <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map(t => (
                <SelectItem key={t} value={t}>{t === 'all' ? 'Todos os tipos' : t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { fetchMedia(); fetchStats(); }}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : media.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-foreground font-semibold">Nenhuma mídia encontrada</p>
            <p className="text-sm text-muted-foreground">Mídias aparecerão aqui quando forem enviadas ao sistema.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {media.map((item: any) => (
                <div key={item.id} className={`group relative rounded-lg border overflow-hidden ${item.is_active ? 'border-border' : 'border-destructive/30 opacity-60'}`}>
                  <div className="aspect-square bg-muted">
                    {item.public_url ? (
                      <img
                        src={item.public_url}
                        alt={item.original_name || 'Mídia'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => toggleActive(item)} title={item.is_active ? 'Desativar' : 'Ativar'}>
                        {item.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      {item.public_url && (
                        <Button variant="secondary" size="sm" className="h-7 w-7 p-0" asChild>
                          <a href={item.public_url} target="_blank" rel="noopener noreferrer" title="Abrir">
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(item)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-white text-center truncate w-full mt-1">{item.original_name || '—'}</p>
                  </div>

                  {/* Bottom info */}
                  <div className="p-1.5 space-y-0.5">
                    <p className="text-[10px] font-medium text-foreground truncate">{item.original_name || 'Sem nome'}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[8px] px-1 py-0">{item.entity_type}</Badge>
                      <span className="text-[8px] text-muted-foreground">{formatSize(item.size_optimized || item.size_original)}</span>
                    </div>
                    {item.user_ref && (
                      <p className="text-[8px] text-muted-foreground truncate">ref: {item.user_ref}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMediaPage;
