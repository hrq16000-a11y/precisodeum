/**
 * AdminNeighborhoodsCrudPage — CRUD de bairros (tabela `neighborhoods`).
 *
 * Schema real: id, city_id (FK cities.id), name, slug, created_at, geom.
 * O spec original mencionava colunas `city`/`state` como texto, mas a tabela
 * real usa `city_id`. Para preservar integridade referencial, este painel
 * exibe cidade/UF derivados do JOIN com `cities` e usa um Select para
 * `city_id` no formulário.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Search, Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import PaginationControls from '@/components/PaginationControls';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

type CityRow = { id: string; name: string; uf?: string | null; state?: string | null };
type NeighborhoodRow = { id: string; name: string; slug: string; city_id: string; created_at: string };

const AdminNeighborhoodsCrudPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<NeighborhoodRow | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', city_id: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-neighborhoods'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhoods' as any)
        .select('id, name, slug, city_id, created_at')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as NeighborhoodRow[];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['admin-neighborhoods-cities'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities' as any)
        .select('id, name, uf, state')
        .order('name', { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data || []) as CityRow[];
    },
  });

  const cityMap = useMemo(() => {
    const m = new Map<string, CityRow>();
    cities.forEach((c) => m.set(c.id, c));
    return m;
  }, [cities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const city = cityMap.get(r.city_id);
      const blob = `${r.name} ${r.slug} ${city?.name || ''} ${city?.uf || city?.state || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, cityMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', slug: '', city_id: '' });
    setEditOpen(true);
  };
  const openEdit = (row: NeighborhoodRow) => {
    setEditItem(row);
    setForm({ name: row.name, slug: row.slug, city_id: row.city_id });
    setEditOpen(true);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error('Nome é obrigatório');
      if (!form.city_id) throw new Error('Cidade é obrigatória');
      const slug = (form.slug.trim() || slugify(name)).slice(0, 80);
      if (editItem) {
        const { error } = await supabase.from('neighborhoods' as any)
          .update({ name, slug, city_id: form.city_id } as any)
          .eq('id', editItem.id);
        if (error) throw error;
        await logAuditAction({ action: 'update', resource_type: 'neighborhood', resource_id: editItem.id, details: { name, slug, city_id: form.city_id } });
      } else {
        const { data, error } = await supabase.from('neighborhoods' as any)
          .insert({ name, slug, city_id: form.city_id } as any)
          .select('id').single();
        if (error) throw error;
        await logAuditAction({ action: 'create', resource_type: 'neighborhood', resource_id: (data as any)?.id, details: { name, slug, city_id: form.city_id } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-neighborhoods'] });
      toast.success(editItem ? 'Bairro atualizado' : 'Bairro criado');
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('neighborhoods' as any).delete().eq('id', id);
      if (error) throw error;
      await logAuditAction({ action: 'delete', resource_type: 'neighborhood', resource_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-neighborhoods'] });
      toast.success('Bairro removido');
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao remover'),
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
              <MapPin className="h-5 w-5" /> Bairros
            </h1>
            <p className="text-sm text-muted-foreground">{rows.length} bairro(s) cadastrado(s)</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo bairro
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, slug ou cidade..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>UF</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum bairro encontrado</TableCell></TableRow>
              ) : (
                paginated.map((row) => {
                  const city = cityMap.get(row.city_id);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.slug}</TableCell>
                      <TableCell>{city?.name || '—'}</TableCell>
                      <TableCell className="text-xs">{city?.uf || city?.state || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteId(row.id)} aria-label="Remover">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar bairro' : 'Novo bairro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
                placeholder="Ex: Centro"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="gerado automaticamente"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Deixe em branco para gerar a partir do nome.</p>
            </div>
            <div>
              <Label>Cidade</Label>
              <Select value={form.city_id} onValueChange={(v) => setForm((f) => ({ ...f, city_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma cidade" /></SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.uf || c.state ? ` / ${c.uf || c.state}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover bairro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Bairros podem estar referenciados por endereços de prestadores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminNeighborhoodsCrudPage;
