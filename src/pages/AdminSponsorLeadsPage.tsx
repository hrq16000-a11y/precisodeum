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
import { Search, Pencil, Trash2, Download, Phone, Mail, ArrowRight, MessageSquare, Clock, CheckCircle2, XCircle, Users2, AlertTriangle, FileText } from 'lucide-react';
import SponsorLeadDocsPanel from '@/components/admin/SponsorLeadDocsPanel';
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

const STATUS_PIPELINE: { key: string; label: string; color: string; icon: any }[] = [
  { key: 'new', label: 'Novo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: AlertTriangle },
  { key: 'contacted', label: 'Em Contato', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Phone },
  { key: 'negotiating', label: 'Negociação', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: MessageSquare },
  { key: 'approved', label: 'Fechado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  { key: 'rejected', label: 'Perdido', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
];

const STATUS_MAP = Object.fromEntries(STATUS_PIPELINE.map(s => [s.key, s]));
const PLAN_MAP: Record<string, string> = { basic: 'Básico', pro: 'Pro', premium: 'Premium' };

const AdminSponsorLeadsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const { data: leads = [] } = useQuery({
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
  const [convertDialog, setConvertDialog] = useState(false);
  const [convertItem, setConvertItem] = useState<any>(null);
  const [contactNote, setContactNote] = useState('');
  const [contactDialog, setContactDialog] = useState(false);
  const [contactItem, setContactItem] = useState<any>(null);

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

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l: any) => { map[l.status] = (map[l.status] || 0) + 1; });
    return map;
  }, [leads]);

  // ── Update status/notes ──
  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sponsor_leads' as any).update({
        status: editForm.status,
        notes: editForm.notes,
        updated_at: new Date().toISOString(),
      } as any).eq('id', editItem.id);
      if (error) throw error;
      await logAuditAction({ action: 'update', resource_type: 'sponsor_lead', resource_id: editItem.id, details: { status: editForm.status, previous_status: editItem.status } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] });
      toast.success('Lead atualizado!');
      setEditDialog(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Register contact (advance to 'contacted' + log note) ──
  const registerContactMutation = useMutation({
    mutationFn: async () => {
      const prevNotes = contactItem.notes || '';
      const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm');
      const newNotes = `${prevNotes}\n\n[${timestamp}] CONTATO: ${contactNote}`.trim();
      const newStatus = contactItem.status === 'new' ? 'contacted' : contactItem.status;
      const { error } = await supabase.from('sponsor_leads' as any).update({
        notes: newNotes,
        status: newStatus,
        updated_at: new Date().toISOString(),
      } as any).eq('id', contactItem.id);
      if (error) throw error;
      await logAuditAction({
        action: 'update',
        resource_type: 'sponsor_lead',
        resource_id: contactItem.id,
        details: { action_type: 'lead_contacted', note: contactNote, previous_status: contactItem.status, new_status: newStatus },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] });
      toast.success('Contato registrado!');
      setContactDialog(false);
      setContactNote('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Convert lead → sponsor ──
  const convertMutation = useMutation({
    mutationFn: async () => {
      const lead = convertItem;
      // 1. Create sponsor
      const { data: sponsor, error: sErr } = await supabase.from('sponsors' as any).insert({
        title: lead.company_name,
        company_name: lead.company_name,
        contact_name: '',
        contact_email: lead.email,
        contact_phone: lead.phone,
        tier: lead.plan === 'premium' ? 'premium' : lead.plan === 'pro' ? 'destaque' : 'basic',
        plan: lead.plan === 'premium' ? 'pro' : 'standard',
        active: true,
        image_url: '',
        link_url: '',
        position: 'home-mid',
      } as any).select('id').single();
      if (sErr) throw sErr;
      const sponsorId = (sponsor as any).id;

      // 2. Create contract
      await supabase.from('sponsor_contracts' as any).insert({
        sponsor_id: sponsorId,
        contract_number: `C-${Date.now().toString(36).toUpperCase()}`,
        status: 'active',
        start_date: new Date().toISOString().slice(0, 10),
        notes: `Convertido do lead ${lead.company_name} (${lead.cnpj})`,
      } as any);

      // 3. Update lead status to approved
      await supabase.from('sponsor_leads' as any).update({
        status: 'approved',
        notes: `${lead.notes || ''}\n\n[${format(new Date(), 'dd/MM/yyyy HH:mm')}] CONVERTIDO → Sponsor ID: ${sponsorId}`.trim(),
        updated_at: new Date().toISOString(),
      } as any).eq('id', lead.id);

      // 4. Audit
      await logAuditAction({
        action: 'update',
        resource_type: 'sponsor_lead',
        resource_id: lead.id,
        details: { action_type: 'lead_converted', sponsor_id: sponsorId, company: lead.company_name },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] });
      toast.success('Lead convertido em patrocinador com sucesso!');
      setConvertDialog(false);
    },
    onError: (e: any) => toast.error(`Erro na conversão: ${e.message}`),
  });

  // ── Delete ──
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

  // ── Quick status change ──
  const quickStatus = async (item: any, newStatus: string) => {
    await supabase.from('sponsor_leads' as any).update({ status: newStatus, updated_at: new Date().toISOString() } as any).eq('id', item.id);
    await logAuditAction({ action: 'update', resource_type: 'sponsor_lead', resource_id: item.id, details: { action_type: `lead_${newStatus}`, previous_status: item.status } });
    qc.invalidateQueries({ queryKey: ['admin-sponsor-leads'] });
    toast.success(`Status → ${STATUS_MAP[newStatus]?.label || newStatus}`);
  };

  const exportCsv = () => {
    const rows = filtered.length > 0 ? filtered : leads;
    const csv = ['Empresa,CNPJ,Email,Telefone,Plano,Status,Contrato Aceito,Data,Notas'].concat(
      rows.map((l: any) => `"${l.company_name}","${l.cnpj}","${l.email}","${l.phone}","${l.plan}","${l.status}","${l.contract_accepted ? 'Sim' : 'Não'}","${l.created_at}","${(l.notes || '').replace(/"/g, '""')}"`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads-patrocinadores_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} lead(s) exportado(s)`);
  };

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">CRM de Patrocinadores</h1>
            <p className="text-sm text-muted-foreground">{leads.length} lead(s) no pipeline</p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        </div>

        {/* Pipeline KPIs */}
        <div className="grid gap-2 grid-cols-5">
          {STATUS_PIPELINE.map(({ key, label, icon: Icon }) => {
            const count = statusCounts[key] || 0;
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => { setStatusFilter(isActive ? 'all' : key); setPage(1); }}
                className={`rounded-lg border p-3 text-center transition-all ${isActive ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50'}`}
              >
                <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold text-foreground leading-tight">{count}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </button>
            );
          })}
        </div>

        {/* Pipeline flow indicator */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground px-1">
          {STATUS_PIPELINE.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full ${STATUS_MAP[s.key]?.color}`}>{s.label}</span>
              {i < STATUS_PIPELINE.length - 1 && <ArrowRight className="h-3 w-3" />}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar empresa, email, CNPJ..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
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
                <TableHead className="w-40">Ações</TableHead>
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
                      {l.notes && <p className="text-[10px] text-muted-foreground/60 truncate max-w-[200px]" title={l.notes}>📝 {l.notes.split('\n').pop()}</p>}
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
                    <div className="flex gap-0.5">
                      {/* Register contact */}
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Registrar contato"
                        onClick={() => { setContactItem(l); setContactNote(''); setContactDialog(true); }}>
                        <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                      </Button>
                      {/* Quick advance */}
                      {l.status === 'new' && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar como contactado"
                          onClick={() => quickStatus(l, 'contacted')}>
                          <Phone className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                      )}
                      {l.status === 'contacted' && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Enviar para negociação"
                          onClick={() => quickStatus(l, 'negotiating')}>
                          <ArrowRight className="h-3.5 w-3.5 text-purple-600" />
                        </Button>
                      )}
                      {(l.status === 'negotiating' || l.status === 'contacted') && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Converter em patrocinador"
                          onClick={() => { setConvertItem(l); setConvertDialog(true); }}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                      )}
                      {/* Edit */}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                        setEditItem(l); setEditForm({ status: l.status, notes: l.notes || '' }); setEditDialog(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* Delete */}
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
                  <p className="text-muted-foreground">Plano: {PLAN_MAP[editItem.plan] || editItem.plan} · Contrato: {editItem.contract_accepted ? 'Aceito' : 'Não'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_PIPELINE.map(s => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas / Histórico</Label>
                  <Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={6} className="text-xs font-mono" />
                </div>
                <Button className="w-full" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  Salvar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Contact Registration Dialog */}
        <Dialog open={contactDialog} onOpenChange={setContactDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Registrar Contato</DialogTitle></DialogHeader>
            {contactItem && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Registrar interação com <strong>{contactItem.company_name}</strong></p>
                <div className="space-y-2">
                  <Label>Observação do contato *</Label>
                  <Textarea value={contactNote} onChange={e => setContactNote(e.target.value)} rows={3} placeholder="Ex: Ligação realizada, aguardando proposta..." />
                </div>
                {contactItem.notes && (
                  <div className="space-y-1">
                    <Label className="text-xs">Histórico anterior</Label>
                    <div className="bg-muted/50 rounded p-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{contactItem.notes}</div>
                  </div>
                )}
                <Button className="w-full" onClick={() => registerContactMutation.mutate()} disabled={registerContactMutation.isPending || !contactNote.trim()}>
                  <Clock className="h-4 w-4 mr-1" /> Registrar Contato
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Convert to Sponsor Dialog */}
        <Dialog open={convertDialog} onOpenChange={setConvertDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Converter Lead → Patrocinador</DialogTitle></DialogHeader>
            {convertItem && (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Esta ação irá:</p>
                  <ul className="text-xs text-green-700 dark:text-green-400 space-y-1 list-disc pl-4">
                    <li>Criar um novo patrocinador: <strong>{convertItem.company_name}</strong></li>
                    <li>Gerar um contrato ativo automaticamente</li>
                    <li>Alterar o status deste lead para "Fechado"</li>
                    <li>Registrar o evento completo na auditoria</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p><strong>Empresa:</strong> {convertItem.company_name}</p>
                  <p><strong>CNPJ:</strong> {convertItem.cnpj}</p>
                  <p><strong>Plano:</strong> {PLAN_MAP[convertItem.plan] || convertItem.plan}</p>
                  <p><strong>Email:</strong> {convertItem.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConvertDialog(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Converter
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSponsorLeadsPage;
