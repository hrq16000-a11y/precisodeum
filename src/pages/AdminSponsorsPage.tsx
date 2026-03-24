import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Pencil, Trash2, ExternalLink, CalendarIcon, Eye, MousePointerClick, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ImageUploadField from '@/components/ImageUploadField';
import SponsorImage, { shapeLabelPt, type BannerShape } from '@/components/SponsorImage';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';

const PAGE_SIZE = 20;

const sizeHints: Record<string, string> = {
  'hero-top': 'Recomendado: 970×90 px (horizontal)',
  'between-sections': 'Recomendado: 728×90 px (leaderboard)',
  'mid-content': 'Recomendado: 728×90 px (leaderboard)',
  sidebar: 'Recomendado: 300×250 px (quadrado)',
  native: 'Recomendado: 600×400 px (card)',
  showcase: 'Recomendado: 600×450 px (4:3)',
  banner: 'Recomendado: 1200×300 px (horizontal)',
  card: 'Recomendado: 600×400 px (3:2)',
  featured: 'Recomendado: 800×450 px (16:9)',
  footer: 'Recomendado: 728×90 px (leaderboard)',
};

interface Sponsor {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  active: boolean;
  display_order: number;
  created_at: string;
  start_date: string | null;
  end_date: string | null;
  impressions: number;
  clicks: number;
}

const emptyForm = { title: '', image_url: '', link_url: '', position: 'banner', active: true, display_order: 0, start_date: '' as string, end_date: '' as string, tier: 'basic' };

const idealSizes: Record<string, { width: number; height: number; label: string }> = {
  'hero-top': { width: 970, height: 90, label: '970×90 px (Leaderboard)' },
  'between-sections': { width: 728, height: 90, label: '728×90 px (Leaderboard)' },
  'mid-content': { width: 728, height: 90, label: '728×90 px (Leaderboard)' },
  sidebar: { width: 300, height: 250, label: '300×250 px (Retângulo)' },
  native: { width: 600, height: 400, label: '600×400 px (Card)' },
  showcase: { width: 600, height: 450, label: '600×450 px (Vitrine)' },
  banner: { width: 1200, height: 300, label: '1200×300 px (Banner)' },
  card: { width: 600, height: 400, label: '600×400 px (Card)' },
  featured: { width: 800, height: 450, label: '800×450 px (Destaque)' },
  footer: { width: 728, height: 90, label: '728×90 px (Rodapé)' },
};

const AdminSponsorsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detectedShape, setDetectedShape] = useState<{ width: number; height: number; shape: BannerShape } | null>(null);

  const loading = authLoading || adminLoading;

  if (!loading && (!user || !isAdmin)) {
    navigate('/');
    return null;
  }

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['admin-sponsors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .is('deleted_at', null)
        .order('display_order');
      if (error) throw error;
      return (data || []) as Sponsor[];
    },
  });

  const bulk = useAdminBulkActions({
    table: 'sponsors',
    resourceType: 'sponsor',
    onComplete: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
      queryClient.invalidateQueries({ queryKey: ['sponsors-home'] });
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return sponsors;
    const q = search.toLowerCase();
    return sponsors.filter(s => (s.title || '').toLowerCase().includes(q));
  }, [sponsors, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        image_url: form.image_url || null,
        link_url: form.link_url || null,
        position: form.position,
        active: form.active,
        display_order: form.display_order,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        tier: form.tier,
      };
      if (editingId) {
        const { error } = await supabase.from('sponsors').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sponsors').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
      queryClient.invalidateQueries({ queryKey: ['sponsors-home'] });
      toast({ title: editingId ? 'Patrocinador atualizado' : 'Patrocinador criado' });
      closeDialog();
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const handleSoftDelete = async (id: string) => {
    if (!confirm('Mover para lixeira?')) return;
    await supabase.from('sponsors').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    await logAuditAction({ action: 'soft_delete', resource_type: 'sponsor', resource_id: id });
    queryClient.invalidateQueries({ queryKey: ['admin-sponsors'] });
    queryClient.invalidateQueries({ queryKey: ['sponsors-home'] });
    toast({ title: 'Patrocinador movido para lixeira' });
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setDetectedShape(null);
  };

  const openEdit = (s: Sponsor) => {
    setEditingId(s.id);
    setForm({
      title: s.title,
      image_url: s.image_url || '',
      link_url: s.link_url || '',
      position: s.position,
      active: s.active,
      display_order: s.display_order,
      start_date: s.start_date || '',
      end_date: s.end_date || '',
      tier: (s as any).tier || 'basic',
    });
    setDialogOpen(true);
  };

  const positionLabels: Record<string, string> = {
    'hero-top': 'Topo (970×90)',
    'between-sections': 'Entre Seções (728×90)',
    'mid-content': 'Meio Conteúdo (728×90)',
    sidebar: 'Lateral (300×250)',
    native: 'Nativo (cards)',
    showcase: 'Vitrine (250×250)',
    banner: 'Banner',
    card: 'Card',
    featured: 'Destaque',
    footer: 'Rodapé',
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Patrocinadores</h1>
          <p className="text-sm text-muted-foreground">Gerencie banners e anúncios da plataforma</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button variant="accent" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              <Plus className="h-4 w-4" /> Novo Patrocinador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Patrocinador' : 'Novo Patrocinador'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div>
                <Label>Imagem</Label>
                <ImageUploadField
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url })}
                  bucket="service-images"
                  folder="sponsors"
                />
                {/* Size recommendation */}
                <div className="mt-1.5 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium">📐 Tamanho ideal: {idealSizes[form.position]?.label || 'Envie a imagem do banner'}</p>
                  <p className="mt-0.5">A imagem será exibida completa (sem cortes) em qualquer dispositivo.</p>
                </div>
                {form.image_url && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30">
                        <p className="text-[10px] font-medium text-muted-foreground">Pré-visualização</p>
                        {detectedShape && (
                          <p className="text-[10px] text-muted-foreground">
                            {detectedShape.width}×{detectedShape.height}px • {shapeLabelPt[detectedShape.shape]}
                          </p>
                        )}
                      </div>
                      <SponsorImage
                        src={form.image_url}
                        alt="Preview"
                        onDimensionsDetected={(w, h, shape) => setDetectedShape({ width: w, height: h, shape })}
                      />
                    </div>
                    {detectedShape && idealSizes[form.position] && (
                      (() => {
                        const ideal = idealSizes[form.position];
                        const wRatio = detectedShape.width / ideal.width;
                        const hRatio = detectedShape.height / ideal.height;
                        const isGoodFit = wRatio >= 0.8 && wRatio <= 1.5 && hRatio >= 0.5 && hRatio <= 2;
                        return (
                          <div className={cn(
                            'rounded-md px-3 py-2 text-xs',
                            isGoodFit ? 'bg-accent/10 text-accent' : 'bg-orange-500/10 text-orange-600'
                          )}>
                            {isGoodFit
                              ? '✅ Proporção compatível com a posição selecionada'
                              : `⚠️ Imagem ${detectedShape.width}×${detectedShape.height} pode não ser ideal para "${positionLabels[form.position]}". Recomendado: ${ideal.label}`
                            }
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label>URL do Link</Label>
                <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Posição</Label>
                <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero-top">Topo Premium (970×90)</SelectItem>
                    <SelectItem value="between-sections">Entre Seções (728×90)</SelectItem>
                    <SelectItem value="mid-content">Meio Conteúdo (728×90)</SelectItem>
                    <SelectItem value="sidebar">Lateral Sticky (300×250)</SelectItem>
                    <SelectItem value="native">Nativo em Listagens</SelectItem>
                    <SelectItem value="showcase">Vitrine Empresas (250×250)</SelectItem>
                    <SelectItem value="banner">Banner Geral</SelectItem>
                    <SelectItem value="card">Card Grid</SelectItem>
                    <SelectItem value="featured">Destaque</SelectItem>
                    <SelectItem value="footer">Rodapé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nível</Label>
                <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Básico (rotativo)</SelectItem>
                    <SelectItem value="destaque">Destaque (mais frequência)</SelectItem>
                    <SelectItem value="premium">Premium (topo + fixo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.start_date ? format(new Date(form.start_date), 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.start_date ? new Date(form.start_date) : undefined}
                        onSelect={(d) => setForm({ ...form, start_date: d ? format(d, 'yyyy-MM-dd') : '' })}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Data Término</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.end_date ? format(new Date(form.end_date), 'dd/MM/yyyy') : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.end_date ? new Date(form.end_date) : undefined}
                        onSelect={(d) => setForm({ ...form, end_date: d ? format(d, 'yyyy-MM-dd') : '' })}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label>Ordem de exibição</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Ativo</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" variant="accent" disabled={saveMutation.isPending}>Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar patrocinadores..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
      </div>

      {bulk.hasSelection && (
        <div className="mt-3">
          <BulkActionsBar
            count={bulk.selectionCount}
            onClear={bulk.clearSelection}
            onDelete={bulk.bulkSoftDelete}
            onExport={() => bulk.exportSelected(filtered, 'patrocinadores')}
            loading={bulk.bulkLoading}
          >
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ active: true })} disabled={bulk.bulkLoading} className="text-green-600 border-green-200">
              Ativar
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ active: false })} disabled={bulk.bulkLoading} className="text-amber-600 border-amber-200">
              Desativar
            </Button>
          </BulkActionsBar>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Carregando...</p>
        ) : paginated.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">Nenhum patrocinador encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Posição</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Métricas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s) => {
                const expired = s.end_date && new Date(s.end_date) < new Date();
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <SelectionCheckbox checked={bulk.selectedIds.has(s.id)} onCheckedChange={() => bulk.toggleSelection(s.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.image_url && <img src={s.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                        <span className="font-medium text-foreground">{s.title}</span>
                        {s.link_url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{positionLabels[s.position] || s.position}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.start_date ? format(new Date(s.start_date), 'dd/MM/yy') : '—'}
                      {' → '}
                      {s.end_date ? format(new Date(s.end_date), 'dd/MM/yy') : '∞'}
                      {expired && <span className="ml-1 text-destructive font-medium">(expirado)</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {s.impressions}</span>
                        <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {s.clicks}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.active && !expired ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                        {expired ? 'Expirado' : s.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleSoftDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminSponsorsPage;
