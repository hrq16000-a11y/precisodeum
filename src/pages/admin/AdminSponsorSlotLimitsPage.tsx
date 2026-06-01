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

  const { data: activeSponsors, isLoading: sponsorsLoading } = useQuery({
    queryKey: ['admin-sponsor-slot-limits:active-sponsors'],
    enabled: isAdmin,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('sponsors' as any)
        .select('position, linked_city, linked_category, plan')
        .eq('active', true)
        .is('deleted_at', null)
        .eq('status', 'active')
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`);
      if (error) throw error;
      return ((data || []) as unknown) as Array<{
        position: string | null;
        linked_city: string | null;
        linked_category: string | null;
        plan: string | null;
      }>;
    },
  });

  const computeOccupied = (row: Row): number | null => {
    if (!activeSponsors) return null;
    const isDefault = row.context_value === '_default';
    switch (row.context_type) {
      case 'global':
        return activeSponsors.length;
      case 'city':
        return activeSponsors.filter((s) =>
          isDefault ? !s.linked_city : s.linked_city === row.context_value).length;
      case 'category':
        return activeSponsors.filter((s) =>
          isDefault ? !s.linked_category : s.linked_category === row.context_value).length;
      case 'position':
        return activeSponsors.filter((s) => s.position === row.context_value).length;
      case 'plan':
        return activeSponsors.filter((s) => s.plan === row.context_value).length;
      default:
        return 0;
    }
  };

  const shouldShowOrphanWarning = useMemo(() => {
    if (!activeSponsors || activeSponsors.length === 0) return false;
    const cityCategoryRows = rows.filter(
      (r) => r.context_type === 'city' || r.context_type === 'category');
    if (cityCategoryRows.length === 0) return false;
    const sumOccupied = cityCategoryRows.reduce(
      (acc, r) => acc + (computeOccupied(r) ?? 0), 0);
    return sumOccupied === 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeSponsors]);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-sponsor-slot-limits'] });
    qc.invalidateQueries({ queryKey: ['admin-sponsor-slot-limits:active-sponsors'] });
  };

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
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo limite
            </Button>
          </div>
        </div>

        {shouldShowOrphanWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-700 dark:text-yellow-400 shrink-0" />
            <p className="text-yellow-900 dark:text-yellow-200">
              Atenção: sponsors ativos sem cidade/categoria vinculada não são
              contabilizados nos slots específicos — aparecem apenas no slot global.
            </p>
          </div>
        )}

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
          <TooltipProvider delayDuration={150}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="text-right">Máx. slots</TableHead>
                <TableHead className="text-right">Ocupados</TableHead>
                <TableHead className="text-right">Disponíveis</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum limite cadastrado</TableCell></TableRow>
              ) : (
                paginated.map((row) => {
                  const occupied = computeOccupied(row);
                  const isInformational = row.context_type === 'position' || row.context_type === 'plan';
                  let availableNode: React.ReactNode = '—';
                  if (occupied !== null) {
                    const available = Math.max(0, row.max_slots - occupied);
                    const pct = row.max_slots > 0 ? available / row.max_slots : 0;
                    const color = available === 0
                      ? 'text-red-600 dark:text-red-400'
                      : pct <= 0.2
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400';
                    availableNode = <span className={`font-mono font-medium ${color}`}>{available}</span>;
                  }
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge variant="outline">{row.context_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.context_value || <span className="text-muted-foreground italic">(qualquer)</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{row.max_slots}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className="inline-flex items-center gap-1 justify-end">
                          {sponsorsLoading || occupied === null ? '—' : occupied}
                          {isInformational && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                Contagem informativa — este contexto não é usado como teto pela RPC de capacidade.
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{availableNode}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.updated_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </TooltipProvider>
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
