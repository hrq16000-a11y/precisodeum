/**
 * AdminSponsorSlotLimitsPage — gestão de limites de slots de patrocínio
 * (tabela `sponsor_slot_limits`).
 *
 * Schema real: id, context_type (text, default 'global'), context_value
 * (text, default ''), max_slots (int, default 3), created_at, updated_at.
 *
 * Operações: listar, criar, editar. Sem delete — slots têm histórico
 * relevante para auditoria comercial.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Search, Plus, Pencil, LayoutGrid, RefreshCw, Info, AlertTriangle } from 'lucide-react';
import PaginationControls from '@/components/PaginationControls';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

const CONTEXT_TYPES = [
  { value: 'global', label: 'Global' },
  { value: 'city', label: 'Cidade' },
  { value: 'category', label: 'Categoria' },
  { value: 'position', label: 'Posição' },
  { value: 'plan', label: 'Plano' },
];

type Row = {
  id: string;
  context_type: string;
  context_value: string;
  max_slots: number;
  created_at: string;
  updated_at: string;
};

const AdminSponsorSlotLimitsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Row | null>(null);
  const [form, setForm] = useState({ context_type: 'global', context_value: '', max_slots: 3 });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-sponsor-slot-limits'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsor_slot_limits' as any)
        .select('*')
        .order('context_type', { ascending: true })
        .order('context_value', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.context_type} ${r.context_value} ${r.max_slots}`.toLowerCase().includes(q));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditItem(null);
    setForm({ context_type: 'global', context_value: '', max_slots: 3 });
    setOpen(true);
  };
  const openEdit = (row: Row) => {
    setEditItem(row);
    setForm({
      context_type: row.context_type,
      context_value: row.context_value,
      max_slots: row.max_slots,
    });
    setOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const ctx = form.context_type.trim();
      if (!ctx) throw new Error('Tipo de contexto é obrigatório');
      const maxSlots = Number(form.max_slots);
      if (!Number.isFinite(maxSlots) || maxSlots < 0) throw new Error('Quantidade inválida');
      const payload = {
        context_type: ctx,
        context_value: form.context_value.trim(),
        max_slots: maxSlots,
        updated_at: new Date().toISOString(),
      };
      if (editItem) {
        const { error } = await supabase.from('sponsor_slot_limits' as any)
          .update(payload as any).eq('id', editItem.id);
        if (error) throw error;
        await logAuditAction({ action: 'update', resource_type: 'sponsor_slot_limit', resource_id: editItem.id, details: payload });
      } else {
        const { data, error } = await supabase.from('sponsor_slot_limits' as any)
          .insert(payload as any).select('id').single();
        if (error) throw error;
        await logAuditAction({ action: 'create', resource_type: 'sponsor_slot_limit', resource_id: (data as any)?.id, details: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-slot-limits'] });
      toast.success(editItem ? 'Limite atualizado' : 'Limite criado');
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  if (adminLoading) {
    return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" /> Limites de Slots de Patrocínio
            </h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} regra(s) — sem deleção (histórico preservado)
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo limite
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por contexto, valor ou quantidade..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="text-right">Máx. slots</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum limite cadastrado</TableCell></TableRow>
              ) : (
                paginated.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant="outline">{row.context_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.context_value || <span className="text-muted-foreground italic">(qualquer)</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{row.max_slots}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.updated_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar limite' : 'Novo limite'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de contexto</Label>
              <Select value={form.context_type} onValueChange={(v) => setForm((f) => ({ ...f, context_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTEXT_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor do contexto</Label>
              <Input
                value={form.context_value}
                onChange={(e) => setForm((f) => ({ ...f, context_value: e.target.value }))}
                placeholder='Ex: "curitiba", "encanador", "home-mid" (vazio = qualquer)'
              />
            </div>
            <div>
              <Label>Máximo de slots</Label>
              <Input
                type="number"
                min={0}
                value={form.max_slots}
                onChange={(e) => setForm((f) => ({ ...f, max_slots: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSponsorSlotLimitsPage;
