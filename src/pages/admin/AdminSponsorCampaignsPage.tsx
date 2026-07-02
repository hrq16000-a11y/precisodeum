/**
 * AdminSponsorCampaignsPage — CRUD de campanhas de patrocínio.
 * Filtros por status/sponsor. Cancelar via UPDATE status. Trigger
 * trg_enforce_sponsor_campaign_limit captura mensagem amigável.
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Megaphone, Plus, Pencil, Trash2, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

type Campaign = {
  id: string; sponsor_id: string; name: string; description: string;
  status: string; start_date: string | null; end_date: string | null;
  budget: number | null; created_at: string; updated_at: string;
};
type Sponsor = { id: string; company_name: string | null };

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'canceled', 'completed'] as const;

const statusVariant = (s: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
  if (s === 'active') return 'default';
  if (s === 'canceled') return 'destructive';
  if (s === 'completed') return 'secondary';
  return 'outline';
};

const emptyForm = {
  sponsor_id: '', name: '', description: '', status: 'draft',
  start_date: '', end_date: '', budget: 0,
};

const AdminSponsorCampaignsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSponsor, setFilterSponsor] = useState<string>('all');

  const { data: sponsors = [] } = useQuery({
    queryKey: ['admin-sponsor-campaigns:sponsors'],
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
    queryKey: ['admin-sponsor-campaigns', filterStatus, filterSponsor],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase.from('sponsor_campaigns')
        .select('*').order('created_at', { ascending: false });
      if (filterStatus !== 'all') q = q.eq('status', filterStatus);
      if (filterSponsor !== 'all') q = q.eq('sponsor_id', filterSponsor);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Campaign[];
    },
  });

  const sponsorName = (id: string) =>
    sponsors.find((s) => s.id === id)?.company_name || id.slice(0, 8);

  const openCreate = () => { setEditItem(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (row: Campaign) => {
    setEditItem(row);
    setForm({
      sponsor_id: row.sponsor_id, name: row.name, description: row.description || '',
      status: row.status, start_date: row.start_date || '', end_date: row.end_date || '',
      budget: Number(row.budget ?? 0),
    });
    setOpen(true);
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.sponsor_id) throw new Error('Selecione um sponsor');
      if (!form.name.trim()) throw new Error('Nome é obrigatório');
      const payload: any = {
        sponsor_id: form.sponsor_id,
        name: form.name.trim(),
        description: form.description || '',
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: Number(form.budget) || 0,
      };
      if (editItem) {
        const { error } = await supabase.from('sponsor_campaigns').update(payload).eq('id', editItem.id);
        if (error) throw error;
        await logAuditAction({ action: 'update', resource_type: 'sponsor_campaign', resource_id: editItem.id, details: payload });
      } else {
        const { data, error } = await supabase.from('sponsor_campaigns').insert(payload).select('id').single();
        if (error) throw error;
        await logAuditAction({ action: 'create', resource_type: 'sponsor_campaign', resource_id: (data as any)?.id, details: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] });
      toast.success(editItem ? 'Campanha atualizada' : 'Campanha criada');
      setOpen(false);
    },
    onError: (e: any) => {
      const code = e?.code;
      const msg = String(e?.message || '');
      if (code === 'P0001' || /limit/i.test(msg)) {
        toast.error('Limite de campanhas atingido para este sponsor.');
      } else {
        toast.error(msg || 'Erro ao salvar');
      }
    },
  });

  const cancelCampaign = useMutation({
    mutationFn: async () => {
      if (!cancelTarget) return;
      const { error } = await supabase.from('sponsor_campaigns')
        .update({ status: 'canceled' }).eq('id', cancelTarget.id);
      if (error) throw error;
      await logAuditAction({ action: 'update', resource_type: 'sponsor_campaign', resource_id: cancelTarget.id, details: { status: 'canceled' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] });
      toast.success('Campanha cancelada');
      setCancelTarget(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const { error } = await supabase.from('sponsor_campaigns').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logAuditAction({ action: 'delete', resource_type: 'sponsor_campaign', resource_id: deleteTarget.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] });
      toast.success('Campanha excluída');
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
              <Megaphone className="h-5 w-5" /> Campanhas de Patrocínio
            </h1>
            <p className="text-sm text-muted-foreground">{rows.length} campanha(s)</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nova campanha
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
                <TableHead>Nome</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">—</TableCell></TableRow>
              ) : rows.map((row) => {
                const canCancel = row.status !== 'canceled' && row.status !== 'completed';
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-sm">{sponsorName(row.sponsor_id)}</TableCell>
                    <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                    <TableCell className="text-xs">{row.start_date || '—'}</TableCell>
                    <TableCell className="text-xs">{row.end_date || '—'}</TableCell>
                    <TableCell className="text-right">{fmt.format(Number(row.budget ?? 0))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canCancel && (
                        <Button size="icon" variant="ghost" onClick={() => setCancelTarget(row)} aria-label="Cancelar">
                          <Ban className="h-4 w-4 text-orange-600" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(row)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar campanha' : 'Nova campanha'}</DialogTitle>
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
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
                <Label>Budget (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: Number(e.target.value) }))} />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Marcar a campanha <strong>{cancelTarget?.name}</strong> como cancelada?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelCampaign.mutate()}>Cancelar campanha</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
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

export default AdminSponsorCampaignsPage;
