import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Search, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationControls from '@/components/PaginationControls';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import LeadEditDialog from '@/components/admin/LeadEditDialog';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import { logAuditAction } from '@/hooks/useAuditLog';
import { format } from 'date-fns';

const PAGE_SIZE = 30;
const STATUS_OPTIONS = ['all', 'new', 'contacted', 'converted', 'closed'];

const AdminLeadsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editLead, setEditLead] = useState<any | null>(null);

  const fetchLeads = async () => {
    let query = supabase
      .from('leads')
      .select('*, providers(business_name)')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data } = await query;
    setLeads(data || []);
  };

  useEffect(() => {
    if (isAdmin) fetchLeads();
  }, [isAdmin, statusFilter]);

  const bulk = useAdminBulkActions({
    table: 'leads',
    resourceType: 'lead',
    onComplete: fetchLeads,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      (l.client_name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.service_needed || '').toLowerCase().includes(q) ||
      (l.providers?.business_name || '').toLowerCase().includes(q)
    );
  }, [leads, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lead permanentemente?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await logAuditAction({ action: 'delete', resource_type: 'lead', resource_id: id });
    toast.success('Lead excluído');
    fetchLeads();
  };

  const statusBadge = (s: string) => {
    if (s === 'new') return 'bg-blue-100 text-blue-800';
    if (s === 'contacted') return 'bg-amber-100 text-amber-800';
    if (s === 'converted') return 'bg-green-100 text-green-800';
    return 'bg-muted text-muted-foreground';
  };

  if (loading) return <AdminLayout><p className="p-4 text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <FileText className="h-6 w-6" /> Gerenciar Leads
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{filtered.length} lead(s)</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por cliente, telefone, serviço..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s === 'all' ? 'Todos' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {bulk.hasSelection && (
        <div className="mt-3">
          <BulkActionsBar
            count={bulk.selectionCount}
            onClear={bulk.clearSelection}
            onExport={() => bulk.exportSelected(filtered, 'leads')}
            loading={bulk.bulkLoading}
          >
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'contacted' })} disabled={bulk.bulkLoading} className="text-amber-600 border-amber-200">
              Marcar Contatado
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'converted' })} disabled={bulk.bulkLoading} className="text-green-600 border-green-200">
              Marcar Convertido
            </Button>
          </BulkActionsBar>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2.5 w-8"></th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Cliente</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Telefone</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Serviço</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Prestador</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Data</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(l => (
              <tr key={l.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5">
                  <SelectionCheckbox checked={bulk.selectedIds.has(l.id)} onCheckedChange={() => bulk.toggleSelection(l.id)} />
                </td>
                <td className="px-3 py-2.5 font-medium text-foreground truncate max-w-[150px]">{l.client_name}</td>
                <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground text-xs">{l.phone}</td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs truncate max-w-[150px]">{l.service_needed || '—'}</td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs truncate max-w-[120px]">{l.providers?.business_name || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(l.status)}`}>{l.status}</span>
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground text-xs">
                  {l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy') : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-0.5">
                    <Button size="sm" variant="ghost" onClick={() => setEditLead(l)} title="Editar">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(l.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum lead encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {Math.ceil(filtered.length / PAGE_SIZE) > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      <LeadEditDialog lead={editLead} onClose={() => setEditLead(null)} onSaved={fetchLeads} />
    </AdminLayout>
  );
};

export default AdminLeadsPage;
