import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, Eye, Search, Download } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';

const statusLabels: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Aprovado', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

const PAGE_SIZE = 20;

const AdminProvidersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [providers, setProviders] = useState<any[]>([]);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchProviders = async () => {
    let query = supabase
      .from('providers')
      .select('*, categories(name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data: providerData } = await query;
    if (!providerData || providerData.length === 0) { setProviders([]); return; }

    const userIds = [...new Set(providerData.map(p => p.user_id))];
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    const profileMap = new Map((profileData || []).map(p => [p.id, p]));
    
    setProviders(providerData.map(p => ({
      ...p,
      profiles: profileMap.get(p.user_id) || null,
    })));
  };

  useEffect(() => { if (isAdmin) fetchProviders(); }, [isAdmin, filter]);

  const bulk = useAdminBulkActions({
    table: 'providers',
    resourceType: 'provider',
    onComplete: fetchProviders,
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('providers').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'Prestador aprovado!' : 'Prestador rejeitado');
    await logAuditAction({ action: status === 'approved' ? 'approve' : 'reject', resource_type: 'provider', resource_id: id });
    fetchProviders();
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return providers;
    const q = search.toLowerCase();
    return providers.filter(p =>
      (p.profiles?.full_name || '').toLowerCase().includes(q) ||
      (p.profiles?.email || '').toLowerCase().includes(q) ||
      (p.business_name || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q)
    );
  }, [providers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Gerenciar Prestadores</h1>
      <p className="mt-1 text-sm text-muted-foreground">{filtered.length} prestador(es)</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {f === 'all' ? 'Todos' : statusLabels[f]?.label || f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
      </div>

      {bulk.hasSelection && (
        <div className="mt-3">
          <BulkActionsBar
            count={bulk.selectionCount}
            onClear={bulk.clearSelection}
            onDelete={bulk.bulkSoftDelete}
            onExport={() => bulk.exportSelected(filtered, 'prestadores')}
            loading={bulk.bulkLoading}
          >
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'approved' })} disabled={bulk.bulkLoading} className="text-green-600 border-green-200">
              <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'rejected' })} disabled={bulk.bulkLoading} className="text-red-600 border-red-200">
              <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
            </Button>
          </BulkActionsBar>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {paginated.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhum prestador encontrado</p>
          </div>
        )}
        {paginated.map(p => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <SelectionCheckbox
                checked={bulk.selectedIds.has(p.id)}
                onCheckedChange={() => bulk.toggleSelection(p.id)}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-foreground">
                      {(p.profiles as any)?.full_name || p.business_name || 'Sem nome'}
                    </h3>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusLabels[p.status]?.cls || 'bg-muted text-muted-foreground'}`}>
                      {statusLabels[p.status]?.label || p.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(p.categories as any)?.name || 'Sem categoria'} • {p.city}, {p.state}
                  </p>
                  <p className="text-xs text-muted-foreground">{(p.profiles as any)?.email} • {p.phone}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {p.slug && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/profissional/${p.slug}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  )}
                  {p.status !== 'approved' && (
                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus(p.id, 'approved')}>
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                  )}
                  {p.status !== 'rejected' && (
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus(p.id, 'rejected')}>
                      <X className="h-4 w-4" /> Rejeitar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminProvidersPage;
