/**
 * AdminSponsorContractsPage — CRUD de contratos de patrocínio.
 * Filtros status/sponsor. Drawer read-only com todos os campos.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { FileText, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

type Contract = {
  id: string; sponsor_id: string; contract_number: string;
  status: string; start_date: string | null; end_date: string | null;
  value: number | null; notes: string; created_at: string; updated_at: string;
};
type Sponsor = { id: string; company_name: string | null };

const STATUS_OPTIONS = ['draft', 'active', 'canceled', 'expired'] as const;

const statusVariant = (s: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (s === 'active') return 'default';
  if (s === 'canceled' || s === 'expired') return 'destructive';
  return 'outline';
};

const emptyForm = {
  sponsor_id: '', contract_number: '', status: 'draft',
  start_date: '', end_date: '', value: 0, notes: '',
};

const AdminSponsorContractsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Contract | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [viewItem, setViewItem] = useState<Contract | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSponsor, setFilterSponsor] = useState<string>('all');

  const { data: sponsors = [] } = useQuery({
    queryKey: ['admin-sponsor-contracts:sponsors'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('sponsors')
        .select('id, company_name').eq('active', true)
        .order('company_name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Sponsor[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ['admin-sponsor-contracts', filterStatus, filterSponsor],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase.from('sponsor_contracts')
        .select('*').order('created_at', { ascending: false });
      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      if (filterSponsor !== 'all') q = q.eq('sponsor_id', filterSponsor);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Contract[];
    },
  });

  const sponsorName = (id: string) =>
    sponsors.find((s) => s.id === id)?.company_name || id.slice(0, 8);
  const displayNumber = (row: Contract) =>
    row.contract_number?.trim() || row.id.slice(0, 8);

  const openCreate = () => { setEditItem(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (row: Contract) => {
    setEditItem(row);
    setForm({
      sponsor_id: row.sponsor_id, contract_number: row.contract_number || '',
      status: row.status, start_date: row.start_date || '', end_date: row.end_date || '',
      value: Number(row.value ?? 0), notes: row.notes || '',
    });
    setOpen(true);
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.sponsor_id) throw new Error('Selecione um sponsor');
      const payload: any = {
        sponsor_id: form.sponsor_id,
        contract_number: form.contract_number || '',
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        value: Number(form.value) || 0,
        notes: form.notes || '',
      };
      if (editItem) {
        const { error } = await supabase.from('sponsor_contracts').update(payload).eq('id', editItem.id);
        if (error) throw error;
        await logAuditAction({ action: 'update', resource_type: 'sponsor_contract', resource_id: editItem.id, details: payload });
      } else {
        const { data, error } = await supabase.from('sponsor_contracts').insert(payload).select('id').single();
        if (error) throw error;
        await logAuditAction({ action: 'create', resource_type: 'sponsor_contract', resource_id: (data as any)?.id, details: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-contracts'] });
      toast.success(editItem ? 'Contrato atualizado' : 'Contrato criado');
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const { error } = await supabase.from('sponsor_contracts').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logAuditAction({ action: 'delete', resource_type: 'sponsor_contract', resource_id: deleteTarget.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-contracts'] });
      toast.success('Contrato excluído');
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });

  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5" /> Contratos de Patrocínio
            </h1>
            <p className="text-sm text-muted-foreground">{rows.length} contrato(s)</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo contrato
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="w-48">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Label className="text-xs">Sponsor</Label>
            <Select value={filterSponsor} onValueChange={setFilterSponsor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sponsors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.company_name || s.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-36 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">—</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{displayNumber(row)}</TableCell>
                  <TableCell className="text-sm">{sponsorName(row.sponsor_id)}</TableCell>
                  <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                  <TableCell className="text-xs">{row.start_date || '—'}</TableCell>
                  <TableCell className="text-xs">{row.end_date || '—'}</TableCell>
                  <TableCell className="text-right">{fmt.format(Number(row.value ?? 0))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setViewItem(row)} aria-label="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Form modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar contrato' : 'Novo contrato'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Sponsor *</Label>
              <Select value={form.sponsor_id} onValueChange={(v) => setForm((f) => ({ ...f, sponsor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um sponsor" /></SelectTrigger>
                <SelectContent>
                  {sponsors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.company_name || s.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número do contrato</Label>
              <Input value={form.contract_number}
                placeholder="Gerado automaticamente"
                onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Início</Label>
                <Input type="date" value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={4} value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View details modal */}
      <Dialog open={!!viewItem} onOpenChange={(o) => !o && setViewItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do contrato</DialogTitle>
            <DialogDescription className="font-mono text-xs">{viewItem?.id}</DialogDescription>
          </DialogHeader>
          {viewItem && (
            <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><dt className="text-muted-foreground text-xs">Número</dt><dd>{displayNumber(viewItem)}</dd></div>
              <div><dt className="text-muted-foreground text-xs">Sponsor</dt><dd>{sponsorName(viewItem.sponsor_id)}</dd></div>
              <div><dt className="text-muted-foreground text-xs">Status</dt><dd><Badge variant={statusVariant(viewItem.status)}>{viewItem.status}</Badge></dd></div>
              <div><dt className="text-muted-foreground text-xs">Valor</dt><dd>{fmt.format(Number(viewItem.value ?? 0))}</dd></div>
              <div><dt className="text-muted-foreground text-xs">Início</dt><dd>{viewItem.start_date || '—'}</dd></div>
              <div><dt className="text-muted-foreground text-xs">Fim</dt><dd>{viewItem.end_date || '—'}</dd></div>
              <div><dt className="text-muted-foreground text-xs">Criado em</dt><dd>{new Date(viewItem.created_at).toLocaleString('pt-BR')}</dd></div>
              <div><dt className="text-muted-foreground text-xs">Atualizado em</dt><dd>{new Date(viewItem.updated_at).toLocaleString('pt-BR')}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Notas</dt>
                <dd className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 mt-1">{viewItem.notes || '—'}</dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{deleteTarget && displayNumber(deleteTarget)}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminSponsorContractsPage;
