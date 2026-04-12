import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, Pencil, Search, Upload, Download, MapPin, Filter,
  Globe, Building2, BarChart3, FileText, CheckCircle2, AlertTriangle, Map
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import PaginationControls from '@/components/PaginationControls';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;

const BRAZILIAN_STATES = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
  'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];


interface City { id: string; name: string; slug: string; state: string; created_at: string; }

const emptyForm = { name: '', slug: '', state: '' };

/* ═══ Neighborhoods Sub-Component ═══ */
const NeighborhoodsTab = ({ cities, isAdmin }: { cities: City[]; isAdmin: boolean }) => {
  const qc = useQueryClient();
  const [nhSearch, setNhSearch] = useState('');
  const [nhCityFilter, setNhCityFilter] = useState('all');
  const [nhDialog, setNhDialog] = useState(false);
  const [nhEditId, setNhEditId] = useState<string | null>(null);
  const [nhForm, setNhForm] = useState({ name: '', slug: '', city_id: '' });

  const { data: neighborhoods = [], isLoading: nhLoading } = useQuery({
    queryKey: ['admin-neighborhoods-full'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('neighborhoods').select('*').order('name');
      return (data || []) as any[];
    },
  });

  const autoSlugNh = (name: string) => name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const cityMap = useMemo(() => {
    const m: Record<string, string> = {};
    cities.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [cities]);

  const filteredNh = useMemo(() => {
    const q = nhSearch.toLowerCase();
    return neighborhoods.filter((n: any) => {
      if (nhCityFilter !== 'all' && n.city_id !== nhCityFilter) return false;
      if (q && !n.name.toLowerCase().includes(q) && !n.slug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [neighborhoods, nhSearch, nhCityFilter]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: nhForm.name.trim(), slug: nhForm.slug.trim() || autoSlugNh(nhForm.name), city_id: nhForm.city_id };
      if (!payload.name || !payload.city_id) throw new Error('Nome e cidade são obrigatórios');
      if (nhEditId) {
        const { error } = await supabase.from('neighborhoods').update(payload).eq('id', nhEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('neighborhoods').insert(payload);
        if (error) throw error;
      }
      await logAuditAction({ action: nhEditId ? 'update' : 'create', resource_type: 'neighborhood', details: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-neighborhoods-full'] });
      qc.invalidateQueries({ queryKey: ['admin-neighborhood-counts'] });
      toast.success(nhEditId ? 'Bairro atualizado!' : 'Bairro criado!');
      setNhDialog(false); setNhEditId(null); setNhForm({ name: '', slug: '', city_id: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('neighborhoods').delete().eq('id', id);
      if (error) throw error;
      await logAuditAction({ action: 'delete', resource_type: 'neighborhood', resource_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-neighborhoods-full'] });
      qc.invalidateQueries({ queryKey: ['admin-neighborhood-counts'] });
      toast.success('Bairro removido');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar bairro..." className="pl-9" value={nhSearch} onChange={e => setNhSearch(e.target.value)} />
          </div>
          <Select value={nhCityFilter} onValueChange={setNhCityFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas as cidades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.state})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setNhEditId(null); setNhForm({ name: '', slug: '', city_id: '' }); setNhDialog(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Bairro
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{filteredNh.length} bairro(s) encontrado(s) de {neighborhoods.length} total</p>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Bairro</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Slug</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Cidade</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredNh.slice(0, 100).map((n: any) => (
              <tr key={n.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{n.name}</td>
                <td className="px-3 py-2 text-muted-foreground text-xs hidden sm:table-cell">/{n.slug}</td>
                <td className="px-3 py-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">{cityMap[n.city_id] || n.city_id.slice(0, 8)}</Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                      setNhEditId(n.id); setNhForm({ name: n.name, slug: n.slug, city_id: n.city_id }); setNhDialog(true);
                    }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                      if (confirm(`Excluir "${n.name}"?`)) deleteMutation.mutate(n.id);
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredNh.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Nenhum bairro encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {filteredNh.length > 100 && <p className="text-xs text-muted-foreground text-center">Mostrando 100 de {filteredNh.length} bairros. Use os filtros para refinar.</p>}

      <Dialog open={nhDialog} onOpenChange={v => { if (!v) { setNhDialog(false); setNhEditId(null); } }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>{nhEditId ? 'Editar Bairro' : 'Novo Bairro'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div><Label>Nome *</Label>
              <Input value={nhForm.name} onChange={e => {
                const name = e.target.value;
                setNhForm(f => ({ ...f, name, slug: nhEditId ? f.slug : autoSlugNh(name) }));
              }} required />
            </div>
            <div><Label>Slug</Label>
              <Input value={nhForm.slug} onChange={e => setNhForm(f => ({ ...f, slug: e.target.value }))} placeholder="gerado automaticamente" />
            </div>
            <div><Label>Cidade *</Label>
              <Select value={nhForm.city_id} onValueChange={v => setNhForm(f => ({ ...f, city_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar cidade" /></SelectTrigger>
                <SelectContent>
                  {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.state})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNhDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminCitiesPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['admin-cities'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('*').order('name');
      return (data || []) as City[];
    },
  });

  const { data: neighborhoodCounts = {} } = useQuery({
    queryKey: ['admin-neighborhood-counts'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('neighborhoods').select('city_id');
      const map: Record<string, number> = {};
      (data || []).forEach((n: any) => { map[n.city_id] = (map[n.city_id] || 0) + 1; });
      return map;
    },
  });

  const { data: providerCityCounts = {} } = useQuery({
    queryKey: ['admin-provider-city-counts'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('providers').select('city').eq('status', 'approved');
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => { if (p.city) map[p.city] = (map[p.city] || 0) + 1; });
      return map;
    },
  });

  // ── State ──
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importText, setImportText] = useState('');
  const [importDialog, setImportDialog] = useState(false);

  // ── Bulk ──
  const bulk = useAdminBulkActions({
    table: 'cities', resourceType: 'city',
    onComplete: () => qc.invalidateQueries({ queryKey: ['admin-cities'] }),
  });

  // ── Filtered / Paginated ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cities.filter(c => {
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q) && !c.state.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cities, search, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Stats ──
  const stateGroups = useMemo(() => {
    const map: Record<string, number> = {};
    cities.forEach(c => { map[c.state] = (map[c.state] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [cities]);


  // ── Auto-slug ──
  const autoSlug = (name: string) => name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name.trim(), slug: form.slug.trim() || autoSlug(form.name), state: form.state.trim().toUpperCase() };
      if (!payload.name || !payload.slug) throw new Error('Nome e slug são obrigatórios');
      if (editId) {
        const { error } = await supabase.from('cities').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cities').insert(payload);
        if (error) throw error;
      }
      await logAuditAction({ action: editId ? 'update' : 'create', resource_type: 'city', details: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cities'] });
      toast.success(editId ? 'Cidade atualizada!' : 'Cidade criada!');
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cities').delete().eq('id', id);
      if (error) throw error;
      await logAuditAction({ action: 'delete', resource_type: 'city', resource_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-cities'] }); toast.success('Cidade removida'); },
    onError: (e: any) => toast.error(e.message),
  });


  const importMutation = useMutation({
    mutationFn: async () => {
      const lines = importText.trim().split('\n').filter(Boolean);
      if (lines.length === 0) throw new Error('Nenhum dado para importar');
      const rows = lines.map(line => {
        const parts = line.split(/[,;\t]/).map(s => s.trim());
        const name = parts[0] || '';
        const state = (parts[1] || '').toUpperCase();
        const slug = parts[2] || autoSlug(name);
        return { name, slug, state };
      }).filter(r => r.name);
      const { error } = await supabase.from('cities').upsert(rows, { onConflict: 'slug' });
      if (error) throw error;
      await logAuditAction({ action: 'bulk_import', resource_type: 'city', details: { count: rows.length } });
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['admin-cities'] });
      toast.success(`${count} cidade(s) importada(s)!`);
      setImportDialog(false);
      setImportText('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Export ──
  const exportCsv = useCallback(() => {
    const data = filtered.length > 0 ? filtered : cities;
    const csv = ['Nome,Slug,Estado', ...data.map(c => `"${c.name}","${c.slug}","${c.state}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cidades_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} cidade(s) exportada(s)`);
  }, [cities, filtered]);

  // ── Helpers ──
  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm(emptyForm); };
  const openEdit = (c: City) => { setEditId(c.id); setForm({ name: c.name, slug: c.slug, state: c.state }); setDialogOpen(true); };
  const openNew = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Cidades</h1>
            <p className="text-sm text-muted-foreground">
              {cities.length} cidade(s) em {stateGroups.length} estado(s)
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportDialog(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Nova Cidade
            </Button>
          </div>
        </div>

        {/* Alerts */}

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[
            { icon: MapPin, label: 'Cidades', value: cities.length, sub: `${stateGroups.length} estados` },
            { icon: Building2, label: 'Capitais', value: CAPITALS.length - missingCapitals.length, sub: `de ${CAPITALS.length}` },
            { icon: Map, label: 'Bairros', value: Object.values(neighborhoodCounts).reduce((a: number, b: number) => a + b, 0), sub: 'cadastrados' },
            { icon: BarChart3, label: 'Com Prestadores', value: Object.keys(providerCityCounts).length, sub: 'cidades ativas' },
          ].map((kpi, i) => (
            <Card key={i}>
              <CardContent className="pt-3 pb-2 flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-1.5"><kpi.icon className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-tight">{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="list" className="space-y-4">
          <TabsList className="h-auto gap-1">
            <TabsTrigger value="list">📋 Lista</TabsTrigger>
            <TabsTrigger value="neighborhoods">🏘️ Bairros</TabsTrigger>
            <TabsTrigger value="states">🗺️ Por Estado</TabsTrigger>
          </TabsList>

          {/* ═══ LIST TAB ═══ */}
          <TabsContent value="list" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cidade..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <Select value={stateFilter} onValueChange={v => { setStateFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos UFs</SelectItem>
                  {BRAZILIAN_STATES.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="text-xs"
                onClick={() => bulk.selectAll(filtered.map(c => c.id))}>
                Selecionar Todos ({filtered.length})
              </Button>
            </div>

            {/* Bulk bar */}
            {bulk.hasSelection && (
              <BulkActionsBar count={bulk.selectionCount} onClear={bulk.clearSelection}
                onDelete={async () => {
                  if (!confirm(`Excluir ${bulk.selectionCount} cidade(s)?`)) return;
                  const ids = Array.from(bulk.selectedIds);
                  for (const id of ids) {
                    await supabase.from('cities').delete().eq('id', id);
                  }
                  await logAuditAction({ action: 'bulk_delete', resource_type: 'city', details: { count: ids.length } });
                  bulk.clearSelection();
                  qc.invalidateQueries({ queryKey: ['admin-cities'] });
                  toast.success(`${ids.length} cidade(s) excluída(s)`);
                }}
                onExport={() => bulk.exportSelected(filtered, 'cidades')} loading={bulk.bulkLoading}>
                <Button size="sm" variant="outline" onClick={() => {
                  const selected = cities.filter(c => bulk.selectedIds.has(c.id));
                  const states = [...new Set(selected.map(c => c.state))];
                  if (states.length === 1) {
                    const newState = prompt(`Alterar UF em massa para (${bulk.selectionCount} cidades):`, states[0]);
                    if (newState && newState.trim()) {
                      const uf = newState.trim().toUpperCase();
                      Promise.all(Array.from(bulk.selectedIds).map(id =>
                        supabase.from('cities').update({ state: uf }).eq('id', id)
                      )).then(() => {
                        qc.invalidateQueries({ queryKey: ['admin-cities'] });
                        toast.success(`UF atualizado para ${uf}`);
                        bulk.clearSelection();
                      });
                    }
                  } else {
                    const newState = prompt('Novo UF para todas as selecionadas:');
                    if (newState && newState.trim()) {
                      const uf = newState.trim().toUpperCase();
                      Promise.all(Array.from(bulk.selectedIds).map(id =>
                        supabase.from('cities').update({ state: uf }).eq('id', id)
                      )).then(() => {
                        qc.invalidateQueries({ queryKey: ['admin-cities'] });
                        toast.success(`UF atualizado para ${uf}`);
                        bulk.clearSelection();
                      });
                    }
                  }
                }} className="text-xs">Alterar UF</Button>
              </BulkActionsBar>
            )}

            {/* Table */}
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma cidade encontrada</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="w-8 px-2 py-2"><SelectionCheckbox checked={paginated.every(c => bulk.selectedIds.has(c.id)) && paginated.length > 0}
                          onCheckedChange={() => {
                            if (paginated.every(c => bulk.selectedIds.has(c.id))) bulk.clearSelection();
                            else bulk.selectAll(paginated.map(c => c.id));
                          }} /></th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Cidade</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden sm:table-cell">Slug</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-16">UF</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-20 hidden md:table-cell">Bairros</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-24 hidden md:table-cell">Prestadores</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs w-24">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginated.map(c => {
                        const nCount = neighborhoodCounts[c.id] || 0;
                        const pCount = providerCityCounts[c.name] || 0;
                        const isCapital = CAPITALS.some(cap => cap.slug === c.slug);
                        return (
                          <tr key={c.id} className={cn(
                            'transition-colors hover:bg-muted/20',
                            bulk.selectedIds.has(c.id) && 'bg-accent/5'
                          )}>
                            <td className="px-2 py-2"><SelectionCheckbox checked={bulk.selectedIds.has(c.id)} onCheckedChange={() => bulk.toggleSelection(c.id)} /></td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground">{c.name}</span>
                                {isCapital && <Badge variant="secondary" className="text-[9px] px-1 py-0">Capital</Badge>}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs hidden sm:table-cell">/{c.slug}</td>
                            <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{c.state}</Badge></td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground hidden md:table-cell">{nCount}</td>
                            <td className="px-3 py-2 text-center hidden md:table-cell">
                              {pCount > 0
                                ? <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{pCount}</Badge>
                                : <span className="text-xs text-muted-foreground">0</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                                  if (confirm(`Excluir "${c.name}"?`)) deleteMutation.mutate(c.id);
                                }}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />}
              </>
            )}
          </TabsContent>

          {/* ═══ NEIGHBORHOODS TAB ═══ */}
          <TabsContent value="neighborhoods" className="space-y-4">
            <NeighborhoodsTab cities={cities} isAdmin={isAdmin} />
          </TabsContent>

          {/* ═══ BY STATE TAB ═══ */}
          <TabsContent value="states" className="space-y-4">
            <p className="text-sm text-muted-foreground">Distribuição de cidades por estado</p>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {BRAZILIAN_STATES.map(uf => {
                const count = stateGroups.find(([s]) => s === uf)?.[1] || 0;
                const hasCapital = CAPITALS.some(cap => cap.state === uf && cities.some(c => c.slug === cap.slug));
                return (
                  <div key={uf} className={cn(
                    'rounded-xl border px-3 py-2.5 transition-all cursor-pointer hover:-translate-y-0.5',
                    count > 0
                      ? 'border-border bg-card hover:border-primary shadow-card'
                      : 'border-muted bg-muted/10 opacity-50'
                  )} onClick={() => { setStateFilter(uf); setPage(1); }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-bold text-foreground">{uf}</span>
                      {hasCapital && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {count} cidade{count !== 1 ? 's' : ''}
                    </p>
                    {count > 0 && (
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${Math.min(100, (count / Math.max(...stateGroups.map(([, v]) => v))) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ CREATE/EDIT DIALOG ═══ */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Editar Cidade' : 'Nova Cidade'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => {
                const name = e.target.value;
                setForm(f => ({ ...f, name, slug: editId ? f.slug : autoSlug(name) }));
              }} required />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="gerado automaticamente" />
            </div>
            <div>
              <Label>Estado (UF) *</Label>
              <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar UF" /></SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ IMPORT DIALOG ═══ */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader><DialogTitle>Importar Cidades</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cole uma linha por cidade no formato: <code className="text-xs bg-muted px-1 py-0.5 rounded">Nome, UF, slug (opcional)</code>
            </p>
            <Textarea rows={8} placeholder={`São Paulo, SP\nRio de Janeiro, RJ, rio-de-janeiro\nCuritiba, PR`}
              value={importText} onChange={e => setImportText(e.target.value)} className="font-mono text-xs" />
            <p className="text-[10px] text-muted-foreground">
              Separadores aceitos: vírgula, ponto-e-vírgula ou tab. O slug é gerado automaticamente se omitido.
              Cidades com slug existente serão atualizadas (upsert).
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportDialog(false)}>Cancelar</Button>
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !importText.trim()}>
                <Upload className="h-4 w-4 mr-1" /> Importar {importText.trim().split('\n').filter(Boolean).length} linha(s)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCitiesPage;
