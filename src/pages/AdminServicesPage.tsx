import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Briefcase, Search, Edit2, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationControls from '@/components/PaginationControls';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import ServiceEditDialog from '@/components/admin/ServiceEditDialog';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import { logAuditAction } from '@/hooks/useAuditLog';
import { format } from 'date-fns';

const PAGE_SIZE = 30;

const AdminServicesPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [services, setServices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [editService, setEditService] = useState<any | null>(null);

  const fetchServices = async () => {
    let query = supabase
      .from('services')
      .select('*, providers(business_name, slug, user_id), categories(name)')
      .order('created_at', { ascending: false });

    if (statusFilter === 'active') query = query.is('deleted_at', null);
    else if (statusFilter === 'deleted') query = query.not('deleted_at', 'is', null);

    const { data } = await query;
    setServices(data || []);
  };

  useEffect(() => {
    if (isAdmin) fetchServices();
  }, [isAdmin, statusFilter]);

  const bulk = useAdminBulkActions({
    table: 'services',
    resourceType: 'service',
    onComplete: fetchServices,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(s =>
      (s.service_name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.providers?.business_name || '').toLowerCase().includes(q) ||
      (s.whatsapp || '').includes(q)
    );
  }, [services, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSoftDelete = async (id: string) => {
    if (!confirm('Mover para lixeira?')) return;
    await supabase.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    await logAuditAction({ action: 'soft_delete', resource_type: 'service', resource_id: id });
    toast.success('Serviço movido para lixeira');
    fetchServices();
  };

  const handleRestore = async (id: string) => {
    await supabase.from('services').update({ deleted_at: null }).eq('id', id);
    await logAuditAction({ action: 'restore', resource_type: 'service', resource_id: id });
    toast.success('Serviço restaurado');
    fetchServices();
  };

  if (loading) return <AdminLayout><p className="p-4 text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Briefcase className="h-6 w-6" /> Gerenciar Serviços
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{filtered.length} serviço(s)</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome, descrição, prestador..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="deleted">Lixeira</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {bulk.hasSelection && (
        <div className="mt-3">
          <BulkActionsBar
            count={bulk.selectionCount}
            onClear={bulk.clearSelection}
            onDelete={bulk.bulkSoftDelete}
            onRestore={statusFilter === 'deleted' ? bulk.bulkRestore : undefined}
            onExport={() => bulk.exportSelected(filtered, 'servicos')}
            loading={bulk.bulkLoading}
            isTrash={statusFilter === 'deleted'}
          />
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2.5 w-8"></th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Prestador</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Preço</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Criado</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(s => (
              <tr key={s.id} className={`border-b border-border bg-card hover:bg-muted/30 transition-colors ${s.deleted_at ? 'opacity-60' : ''}`}>
                <td className="px-3 py-2.5">
                  <SelectionCheckbox checked={bulk.selectedIds.has(s.id)} onCheckedChange={() => bulk.toggleSelection(s.id)} />
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground truncate max-w-[200px]">{s.service_name}</p>
                  {s.deleted_at && <Badge variant="destructive" className="text-[9px] mt-0.5">Lixeira</Badge>}
                </td>
                <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground text-xs truncate max-w-[150px]">
                  {s.providers?.business_name || '—'}
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">{s.categories?.name || '—'}</td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">{s.price || '—'}</td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground text-xs">
                  {s.created_at ? format(new Date(s.created_at), 'dd/MM/yyyy') : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-0.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditService(s)} title="Editar"><Edit2 className="h-3.5 w-3.5" /></Button>
                    {s.deleted_at ? (
                      <Button size="sm" variant="ghost" onClick={() => handleRestore(s.id)} title="Restaurar">
                        <RotateCcw className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleSoftDelete(s.id)} title="Lixeira">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum serviço encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {Math.ceil(filtered.length / PAGE_SIZE) > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      <ServiceEditDialog service={editService} onClose={() => setEditService(null)} onSaved={fetchServices} />
    </AdminLayout>
  );
};

export default AdminServicesPage;
