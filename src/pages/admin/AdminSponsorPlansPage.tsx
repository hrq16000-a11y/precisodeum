/**
 * AdminSponsorPlansPage — CRUD de planos de patrocínio (sponsor_plans).
 * Toggle ativo/inativo, modal de criação/edição com listas JSONB
 * (features / included_cities / included_categories) e proteção de
 * delete contra planos vinculados a sponsor_subscriptions.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
import { Package, Plus, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  duration_days: number;
  max_impressions: number | null;
  max_slots: number | null;
  max_slots_per_city: number;
  max_slots_per_category: number;
  budget_limit: number | null;
  performance_rate_per_lead: number;
  features: string[];
  included_cities: string[];
  included_categories: string[];
  active: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const emptyForm = {
  name: '', slug: '', description: '',
  price_monthly: 0, price_yearly: 0, duration_days: 30,
  max_impressions: -1, max_slots: 1,
  max_slots_per_city: 1, max_slots_per_category: 1,
  budget_limit: '' as string | number,
  performance_rate_per_lead: 0,
  display_order: 0, active: true,
  features: [] as string[],
  included_cities: [] as string[],
  included_categories: [] as string[],
  unlimited_impressions: true,
};

type FormState = typeof emptyForm;

const StringListEditor = ({ label, items, onChange }: {
  label: string; items: string[]; onChange: (next: string[]) => void;
}) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) { setDraft(''); return; }
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Digite e clique em Adicionar"
        />
        <Button type="button" variant="outline" onClick={add}>Adicionar</Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {items.map((it) => (
            <Badge key={it} variant="secondary" className="gap-1 pr-1">
              {it}
              <button
                type="button"
                onClick={() => onChange(items.filter((x) => x !== it))}
                className="rounded-sm hover:bg-destructive/20 p-0.5"
                aria-label={`Remover ${it}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminSponsorPlansPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Plan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleteBlockedCount, setDeleteBlockedCount] = useState<number | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ['admin-sponsor-plans'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsor_plans')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Plan[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (row: Plan) => {
      const next = !row.active;
      const { error } = await supabase.from('sponsor_plans')
        .update({ active: next }).eq('id', row.id);
      if (error) throw error;
      await logAuditAction({ action: 'update', resource_type: 'sponsor_plan', resource_id: row.id, details: { active: next } });
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-plans'] });
      toast.success(next ? 'Plano ativado' : 'Plano desativado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao alterar status'),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
    setOpen(true);
  };
  const openEdit = (row: Plan) => {
    setEditItem(row);
    setForm({
      name: row.name,
      slug: row.slug,
      description: row.description ?? '',
      price_monthly: Number(row.price_monthly ?? 0),
      price_yearly: Number(row.price_yearly ?? 0),
      duration_days: row.duration_days,
      max_impressions: row.max_impressions ?? -1,
      max_slots: row.max_slots ?? 1,
      max_slots_per_city: row.max_slots_per_city,
      max_slots_per_category: row.max_slots_per_category,
      budget_limit: row.budget_limit == null ? '' : Number(row.budget_limit),
      performance_rate_per_lead: Number(row.performance_rate_per_lead ?? 0),
      display_order: row.display_order ?? 0,
      active: row.active ?? true,
      features: Array.isArray(row.features) ? row.features as string[] : [],
      included_cities: Array.isArray(row.included_cities) ? row.included_cities as string[] : [],
      included_categories: Array.isArray(row.included_categories) ? row.included_categories as string[] : [],
      unlimited_impressions: (row.max_impressions ?? -1) === -1,
    });
    setOpen(true);
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Nome é obrigatório');
      const slug = (form.slug || slugify(form.name)).trim();
      if (!slug) throw new Error('Slug é obrigatório');
      if (form.duration_days < 1) throw new Error('Duração deve ser ≥ 1');
      const payload: any = {
        name: form.name.trim(),
        slug,
        description: form.description || '',
        price_monthly: Number(form.price_monthly) || 0,
        price_yearly: Number(form.price_yearly) || 0,
        duration_days: Number(form.duration_days),
        max_impressions: form.unlimited_impressions ? -1 : Number(form.max_impressions),
        max_slots: Number(form.max_slots) || 1,
        max_slots_per_city: Number(form.max_slots_per_city) || 1,
        max_slots_per_category: Number(form.max_slots_per_category) || 1,
        budget_limit: form.budget_limit === '' || form.budget_limit == null ? null : Number(form.budget_limit),
        performance_rate_per_lead: Number(form.performance_rate_per_lead) || 0,
        display_order: Number(form.display_order) || 0,
        active: form.active,
        features: form.features,
        included_cities: form.included_cities,
        included_categories: form.included_categories,
      };
      if (editItem) {
        const { error } = await supabase.from('sponsor_plans').update(payload).eq('id', editItem.id);
        if (error) throw error;
        await logAuditAction({ action: 'update', resource_type: 'sponsor_plan', resource_id: editItem.id, details: payload });
      } else {
        const { data, error } = await supabase.from('sponsor_plans').insert(payload).select('id').single();
        if (error) throw error;
        await logAuditAction({ action: 'create', resource_type: 'sponsor_plan', resource_id: (data as any)?.id, details: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-plans'] });
      toast.success(editItem ? 'Plano atualizado' : 'Plano criado');
      setOpen(false);
    },
    onError: (e: any) => {
      const msg = String(e?.message || '');
      if (msg.includes('duplicate key') || e?.code === '23505') toast.error('Slug já existe — use outro');
      else toast.error(msg || 'Erro ao salvar');
    },
  });

  const handleAskDelete = async (row: Plan) => {
    setDeleteTarget(row);
    setDeleteBlockedCount(null);
    const { count, error } = await supabase
      .from('sponsor_subscriptions' as any)
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', row.id);
    if (error) {
      setDeleteBlockedCount(0);
      return;
    }
    setDeleteBlockedCount(count ?? 0);
  };

  const confirmDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const { error } = await supabase.from('sponsor_plans').delete().eq('id', deleteTarget.id);
      if (error) {
        if ((error as any).code === '23503') throw new Error('Este plano está em uso e não pode ser excluído');
        throw error;
      }
      await logAuditAction({ action: 'delete', resource_type: 'sponsor_plan', resource_id: deleteTarget.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-plans'] });
      toast.success('Plano excluído');
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
              <Package className="h-5 w-5" /> Planos de Patrocínio
            </h1>
            <p className="text-sm text-muted-foreground">{rows.length} plano(s) cadastrado(s)</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo plano
          </Button>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Mensal</TableHead>
                <TableHead className="text-right">Anual</TableHead>
                <TableHead className="text-right">Slots</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ordem</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">—</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{row.slug}</TableCell>
                  <TableCell className="text-right">{fmt.format(Number(row.price_monthly ?? 0))}</TableCell>
                  <TableCell className="text-right">{fmt.format(Number(row.price_yearly ?? 0))}</TableCell>
                  <TableCell className="text-right font-mono">{row.max_slots ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!row.active}
                        onCheckedChange={() => toggleActive.mutate(row)}
                        aria-label="Toggle ativo"
                      />
                      <Badge variant={row.active ? 'default' : 'outline'}>
                        {row.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{row.display_order ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleAskDelete(row)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar plano' : 'Novo plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f, name,
                      slug: !editItem && (f.slug === '' || f.slug === slugify(f.name)) ? slugify(name) : f.slug,
                    }));
                  }}
                />
              </div>
              <div>
                <Label>Slug *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Preço mensal (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.price_monthly}
                  onChange={(e) => setForm((f) => ({ ...f, price_monthly: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Preço anual (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.price_yearly}
                  onChange={(e) => setForm((f) => ({ ...f, price_yearly: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Duração (dias) *</Label>
                <Input type="number" min={1} value={form.duration_days}
                  onChange={(e) => setForm((f) => ({ ...f, duration_days: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Máx. impressões</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Checkbox
                    id="unlim"
                    checked={form.unlimited_impressions}
                    onCheckedChange={(v) => setForm((f) => ({
                      ...f, unlimited_impressions: !!v,
                      max_impressions: v ? -1 : Math.max(0, Number(f.max_impressions) || 0),
                    }))}
                  />
                  <Label htmlFor="unlim" className="text-sm font-normal cursor-pointer">Ilimitado (-1)</Label>
                </div>
                {!form.unlimited_impressions && (
                  <Input className="mt-2" type="number" min={0} value={form.max_impressions}
                    onChange={(e) => setForm((f) => ({ ...f, max_impressions: Number(e.target.value) }))} />
                )}
              </div>
              <div>
                <Label>Máx. slots</Label>
                <Input type="number" min={1} value={form.max_slots}
                  onChange={(e) => setForm((f) => ({ ...f, max_slots: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Máx. slots por cidade</Label>
                <Input type="number" min={1} value={form.max_slots_per_city}
                  onChange={(e) => setForm((f) => ({ ...f, max_slots_per_city: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Máx. slots por categoria</Label>
                <Input type="number" min={1} value={form.max_slots_per_category}
                  onChange={(e) => setForm((f) => ({ ...f, max_slots_per_category: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Budget limit (R$, vazio = null)</Label>
                <Input type="number" min={0} step="0.01" value={form.budget_limit}
                  onChange={(e) => setForm((f) => ({ ...f, budget_limit: e.target.value === '' ? '' : Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Taxa por lead (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.performance_rate_per_lead}
                  onChange={(e) => setForm((f) => ({ ...f, performance_rate_per_lead: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Ordem de exibição</Label>
                <Input type="number" min={0} value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, active: !!v }))} />
                  <span className="text-sm">Plano ativo</span>
                </label>
              </div>
            </div>

            <StringListEditor label="Recursos (features)" items={form.features}
              onChange={(next) => setForm((f) => ({ ...f, features: next }))} />
            <StringListEditor label="Cidades incluídas" items={form.included_cities}
              onChange={(next) => setForm((f) => ({ ...f, included_cities: next }))} />
            <StringListEditor label="Categorias incluídas" items={form.included_categories}
              onChange={(next) => setForm((f) => ({ ...f, included_categories: next }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlockedCount === null ? (
                'Verificando vínculos...'
              ) : deleteBlockedCount > 0 ? (
                <>Este plano está vinculado a <strong>{deleteBlockedCount}</strong> assinatura(s) ativa(s) e não pode ser excluído. Desative-o em vez de excluir.</>
              ) : (
                <>Tem certeza que deseja excluir o plano <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteBlockedCount === 0 ? (
              <>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => confirmDelete.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogCancel>Entendido</AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminSponsorPlansPage;
