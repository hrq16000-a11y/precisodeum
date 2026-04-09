import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search, Pencil, Trash2, Download, Eye, Phone, Mail, Building2, FileText, HandshakeIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: 'Novo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  contacted: { label: 'Contactado', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  negotiating: { label: 'Negociando', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

const PLAN_MAP: Record<string, string> = { basic: 'Básico', pro: 'Pro', premium: 'Premium' };

const AdminSponsorLeadsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['admin-sponsor-leads'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_leads' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: '', notes: '' });

  const bulk = useAdminBulkActions({
    table: 'sponsor_leads' as any,
    resourceType: 'sponsor_lead',
    onComplete: () => qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l: any) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (q && !l.company_name.toLowerCase().includes(q) && !l.email.toLowerCase().includes(q) && !l.cnpj.includes(q)) return false;
      return true;
    });
  }, [leads, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sponsor_leads' as any).update({
        status: editForm.status,
        notes: editForm.notes,
        updated_at: new Date().toISOString(),
      } as any).eq('id', editItem.id);
      if (error) throw error;
      await logAuditAction({ action: 'update', resource_type: 'sponsor_lead', resource_id: editItem.id, details: { status: editForm.status } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] });
      toast.success('Lead atualizado!');
      setEditDialog(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sponsor_leads' as any).delete().eq('id', id);
      if (error) throw error;
      await logAuditAction({ action: 'delete', resource_type: 'sponsor_lead', resource_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] });
      toast.success('Lead removido');
    },
  });

  const exportCsv = () => {
    const rows = filtered.length > 0 ? filtered : leads;
    const csv = ['Empresa,CNPJ,Email,Telefone,Plano,Status,Contrato Aceito,Data'].concat(
      rows.map((l: any) => `"${l.company_name}","${l.cnpj}","${l.email}","${l.phone}","${l.plan}","${l.status}","${l.contract_accepted ? 'Sim' : 'Não'}","${l.created_at}"`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads-patrocinadores_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} lead(s) exportado(s)`);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setEditForm({ status: item.status, notes: item.notes || '' });
    setEditDialog(true);
  };

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l: any) => { map[l.status] = (map[l.status] || 0) + 1; });
    return map;
  }, [leads]);

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Leads de Patrocinadores</h1>
            <p className="text-sm text-muted-foreground">{leads.length} lead(s) comerciais</p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
          {Object.entries(STATUS_MAP).map(([key, { label }]) => (
            <Card key={key}>
              <CardContent className="pt-3 pb-2 text-center">
                <p className="text-lg font-bold text-foreground">{statusCounts[key] || 0}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar empresa, email, CNPJ..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bulk */}
        {bulk.hasSelection && (
          <BulkActionsBar count={bulk.selectionCount} onClear={bulk.clearSelection}
            onDelete={async () => {
              const ids = Array.from(bulk.selectedIds);
              for (const id of ids) await supabase.from('sponsor_leads' as any).delete().eq('id', id);
              await logAuditAction({ action: 'bulk_delete', resource_type: 'sponsor_lead', details: { count: ids.length } });
              bulk.clearSelection();
              qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] });
              toast.success(`${ids.length} lead(s) removido(s)`);
            }}
            onExport={() => bulk.exportSelected(filtered, 'leads-patrocinadores')} loading={bulk.bulkLoading} />
        )}

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectionCheckbox checked={paginated.length > 0 && paginated.every((l: any) => bulk.selectedIds.has(l.id))}
                    onCheckedChange={(c) => c ? bulk.selectAll(paginated.map((l: any) => l.id)) : bulk.clearSelection()} />
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="hidden sm:table-cell">Contato</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <SelectionCheckbox checked={bulk.selectedIds.has(l.id)} onCheckedChange={() => bulk.toggleSelection(l.id)} />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{l.company_name}</p>
                      <p className="text-xs text-muted-foreground">{l.cnpj}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="text-xs space-y-0.5">
                      <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</div>
                      <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{PLAN_MAP[l.plan] || l.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${STATUS_MAP[l.status]?.color || ''}`}>
                      {STATUS_MAP[l.status]?.label || l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {format(new Date(l.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(l)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                        if (confirm('Remover este lead?')) deleteMutation.mutate(l.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />}

        {/* Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Lead</DialogTitle></DialogHeader>
            {editItem && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <p className="font-semibold">{editItem.company_name}</p>
                  <p className="text-muted-foreground">CNPJ: {editItem.cnpj}</p>
                  <p className="text-muted-foreground">{editItem.email} · {editItem.phone}</p>
                  <p className="text-muted-foreground">Plano: {PLAN_MAP[editItem.plan] || editItem.plan}</p>
                  <p className="text-muted-foreground">Contrato aceito: {editItem.contract_accepted ? 'Sim' : 'Não'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
                </div>
                <Button className="w-full" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  Salvar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSponsorLeadsPage;
