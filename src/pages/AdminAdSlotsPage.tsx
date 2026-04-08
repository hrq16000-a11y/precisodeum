import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  LayoutGrid, Plus, Trash2, Link2, Eye, MousePointerClick, Search,
  Pencil, Monitor, PanelTop, PanelBottom, Columns, Image as ImageIcon,
  FileText, Briefcase, Home, Users, Globe, MapPin, ArrowUpDown, GripVertical
} from 'lucide-react';

/* ─── Slot illustration metadata ─── */
const SLOT_VISUAL_MAP: Record<string, { icon: any; color: string; size: string; preview: string }> = {
  'global-top':               { icon: PanelTop,    color: 'text-red-500',    size: '1200×90 px (leaderboard)', preview: 'Faixa larga no topo de todas as páginas, acima do conteúdo' },
  'below-header':             { icon: PanelTop,    color: 'text-orange-500', size: '1200×90 px (leaderboard)', preview: 'Logo abaixo do menu de navegação, visível em todas as páginas' },
  'home-between':             { icon: Columns,     color: 'text-blue-500',   size: '728×90 px (banner)', preview: 'Faixa horizontal entre seções da homepage (ex: após Categorias)' },
  'home-mid':                 { icon: ImageIcon,   color: 'text-purple-500', size: '728×200 px (nativo)', preview: 'Card nativo integrado no meio da homepage, aparência de conteúdo' },
  'home-footer':              { icon: PanelBottom,  color: 'text-green-500',  size: '728×90 px (banner)', preview: 'Banner acima do rodapé da homepage' },
  'jobs-top':                 { icon: Briefcase,   color: 'text-amber-500',  size: '728×90 px (banner)', preview: 'Banner no topo da listagem de vagas' },
  'jobs-between':             { icon: FileText,    color: 'text-cyan-500',   size: '300×250 px (card)', preview: 'Card nativo intercalado entre vagas listadas (a cada 5 itens)' },
  'jobs-sidebar':             { icon: Columns,     color: 'text-teal-500',   size: '300×600 px (half-page)', preview: 'Coluna lateral direita na página de vagas (desktop)' },
  'profile-top':              { icon: Users,       color: 'text-indigo-500', size: '728×90 px (banner)', preview: 'Banner horizontal no topo do perfil do profissional' },
  'profile-after-desc':       { icon: FileText,    color: 'text-sky-500',    size: '300×250 px (retângulo)', preview: 'Retângulo após a descrição do profissional' },
  'profile-between-services': { icon: Columns,     color: 'text-violet-500', size: '728×90 px (banner)', preview: 'Faixa entre os serviços listados no perfil' },
  'profile-before-whatsapp':  { icon: Monitor,     color: 'text-emerald-500',size: '300×100 px (inline)', preview: 'Banner compacto acima do botão de WhatsApp' },
  'profile-footer':           { icon: PanelBottom,  color: 'text-rose-500',   size: '728×90 px (banner)', preview: 'Banner no rodapé da página do profissional' },
  'category-top':             { icon: Home,        color: 'text-amber-600',  size: '728×90 px (banner)', preview: 'Banner no topo da listagem de categoria' },
  'category-between':         { icon: FileText,    color: 'text-lime-600',   size: '300×250 px (card)', preview: 'Card nativo intercalado entre profissionais da categoria' },
  'sidebar':                  { icon: Columns,     color: 'text-blue-600',   size: '300×600 px (half-page)', preview: 'Sidebar lateral em páginas de conteúdo (blog, serviços)' },
  'global-footer':            { icon: PanelBottom,  color: 'text-gray-500',   size: '1200×90 px (leaderboard)', preview: 'Faixa acima do rodapé global, visível em todas as páginas' },
};

const PAGE_TYPES = [
  { value: 'global', label: 'Global', icon: Globe },
  { value: 'home', label: 'Home', icon: Home },
  { value: 'jobs', label: 'Vagas', icon: Briefcase },
  { value: 'profile', label: 'Perfil', icon: Users },
  { value: 'category', label: 'Categoria', icon: MapPin },
  { value: 'blog', label: 'Blog', icon: FileText },
];

const PAGE_TYPE_COLORS: Record<string, string> = {
  global: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  home: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  jobs: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  profile: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  category: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  blog: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

const AdminAdSlotsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: slots = [] } = useQuery({
    queryKey: ['admin-ad-slots'],
    queryFn: async () => {
      const { data } = await supabase.from('ad_slots' as any).select('*').order('display_order');
      return (data || []) as any[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['admin-ad-assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('ad_slot_assignments' as any).select('*').order('priority', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: sponsors = [] } = useQuery({
    queryKey: ['admin-sponsors-for-slots'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsors').select('id, title, image_url, active, tier, company_name');
      return (data || []) as any[];
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['admin-sponsor-metrics-summary'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_metrics' as any)
        .select('sponsor_id, slot_slug, event_type, count, event_date')
        .order('event_date', { ascending: false })
        .limit(500);
      return (data || []) as any[];
    },
  });

  // States
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({
    slot_id: '', sponsor_id: '', priority: '0', start_date: '', end_date: '',
    target_category: '', target_city: '', target_state: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [pageFilter, setPageFilter] = useState('all');
  const [slotDialog, setSlotDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [slotForm, setSlotForm] = useState({ name: '', slug: '', description: '', page_type: 'global', max_ads: '1', display_order: '0' });

  // Mutations
  const toggleSlot = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('ad_slots' as any).update({ active } as any).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ad-slots'] }),
  });

  const saveSlotMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: slotForm.name,
        slug: slotForm.slug,
        description: slotForm.description,
        page_type: slotForm.page_type,
        max_ads: Number(slotForm.max_ads) || 1,
        display_order: Number(slotForm.display_order) || 0,
      };
      if (editingSlot) {
        const { error } = await supabase.from('ad_slots' as any).update(payload as any).eq('id', editingSlot.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ad_slots' as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ad-slots'] });
      toast.success(editingSlot ? 'Slot atualizado!' : 'Slot criado!');
      closeSlotDialog();
    },
    onError: (e: any) => toast.error(e.message?.includes('duplicate') ? 'Slug já existe' : 'Erro ao salvar slot'),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('ad_slot_assignments' as any).delete().eq('slot_id', id);
      await supabase.from('ad_slots' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ad-slots'] });
      qc.invalidateQueries({ queryKey: ['admin-ad-assignments'] });
      toast.success('Slot removido');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ad_slot_assignments' as any).insert({
        slot_id: assignForm.slot_id,
        sponsor_id: assignForm.sponsor_id,
        priority: Number(assignForm.priority) || 0,
        start_date: assignForm.start_date || null,
        end_date: assignForm.end_date || null,
        target_category: assignForm.target_category || null,
        target_city: assignForm.target_city || null,
        target_state: assignForm.target_state || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ad-assignments'] });
      toast.success('Patrocinador atribuído!');
      setAssignDialog(false);
      setAssignForm({ slot_id: '', sponsor_id: '', priority: '0', start_date: '', end_date: '', target_category: '', target_city: '', target_state: '' });
    },
    onError: (e: any) => toast.error(e.message?.includes('unique') ? 'Já atribuído' : 'Erro ao atribuir'),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('ad_slot_assignments' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ad-assignments'] });
      toast.success('Atribuição removida');
    },
  });

  const toggleAssignment = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('ad_slot_assignments' as any).update({ active } as any).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ad-assignments'] }),
  });

  // Helpers
  const getSponsorTitle = (id: string) => {
    const s = sponsors.find((s: any) => s.id === id);
    return s?.title || s?.company_name || id.slice(0, 8);
  };
  const getSponsorImage = (id: string) => sponsors.find((s: any) => s.id === id)?.image_url;

  const closeSlotDialog = () => {
    setSlotDialog(false);
    setEditingSlot(null);
    setSlotForm({ name: '', slug: '', description: '', page_type: 'global', max_ads: '1', display_order: '0' });
  };

  const openEditSlot = (slot: any) => {
    setEditingSlot(slot);
    setSlotForm({
      name: slot.name,
      slug: slot.slug,
      description: slot.description || '',
      page_type: slot.page_type,
      max_ads: String(slot.max_ads),
      display_order: String(slot.display_order),
    });
    setSlotDialog(true);
  };

  // Metrics aggregation
  const metricsSummary = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number }>();
    metrics.forEach((m: any) => {
      const key = `${m.sponsor_id}__${m.slot_slug}`;
      const existing = map.get(key) || { impressions: 0, clicks: 0 };
      if (m.event_type === 'impression') existing.impressions += m.count;
      else if (m.event_type === 'click') existing.clicks += m.count;
      map.set(key, existing);
    });
    return map;
  }, [metrics]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s: any) => {
      if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase()) && !s.slug.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (pageFilter !== 'all' && s.page_type !== pageFilter) return false;
      return true;
    });
  }, [slots, searchTerm, pageFilter]);

  // Group by page type for visual map
  const slotsByPage = useMemo(() => {
    const map: Record<string, any[]> = {};
    slots.forEach((s: any) => {
      if (!map[s.page_type]) map[s.page_type] = [];
      map[s.page_type].push(s);
    });
    return map;
  }, [slots]);

  const totalImpressions = useMemo(() => Array.from(metricsSummary.values()).reduce((a, m) => a + m.impressions, 0), [metricsSummary]);
  const totalClicks = useMemo(() => Array.from(metricsSummary.values()).reduce((a, m) => a + m.clicks, 0), [metricsSummary]);
  const activeSlots = slots.filter((s: any) => s.active).length;
  const activeAssignments = assignments.filter((a: any) => a.active).length;

  // Drag-and-drop state
  const dragItem = useRef<{ id: string; pageType: string } | null>(null);
  const dragOverItem = useRef<{ id: string; pageType: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const reorderMutation = useMutation({
    mutationFn: async (reorderedSlots: { id: string; display_order: number }[]) => {
      await Promise.all(
        reorderedSlots.map(s =>
          supabase.from('ad_slots' as any).update({ display_order: s.display_order } as any).eq('id', s.id)
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ad-slots'] });
      toast.success('Ordem atualizada!');
    },
  });

  const handleDragStart = useCallback((id: string, pageType: string) => {
    dragItem.current = { id, pageType };
  }, []);

  const handleDragEnter = useCallback((id: string, pageType: string) => {
    dragOverItem.current = { id, pageType };
    setDragOverId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
    if (!dragItem.current || !dragOverItem.current) return;
    if (dragItem.current.pageType !== dragOverItem.current.pageType) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const pageType = dragItem.current.pageType;
    const pageSlots = [...(slotsByPage[pageType] || [])].sort((a: any, b: any) => a.display_order - b.display_order);
    const fromIdx = pageSlots.findIndex((s: any) => s.id === dragItem.current!.id);
    const toIdx = pageSlots.findIndex((s: any) => s.id === dragOverItem.current!.id);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    const [moved] = pageSlots.splice(fromIdx, 1);
    pageSlots.splice(toIdx, 0, moved);
    const updates = pageSlots.map((s: any, i: number) => ({ id: s.id, display_order: i }));
    reorderMutation.mutate(updates);
    dragItem.current = null;
    dragOverItem.current = null;
  }, [slotsByPage, reorderMutation]);

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;
  if (!isAdmin) { navigate('/'); return null; }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Slots de Anúncios</h1>
            <p className="text-sm text-muted-foreground">Gerencie posições, atribua patrocinadores e acompanhe métricas em tempo real</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditingSlot(null); setSlotForm({ name: '', slug: '', description: '', page_type: 'global', max_ads: '1', display_order: '0' }); setSlotDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Slot
            </Button>
            <Button size="sm" onClick={() => setAssignDialog(true)}>
              <Link2 className="h-4 w-4 mr-1" /> Atribuir Patrocinador
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><LayoutGrid className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold text-foreground">{slots.length}</p><p className="text-[11px] text-muted-foreground">Slots ({activeSlots} ativos)</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2"><Link2 className="h-5 w-5 text-accent-foreground" /></div>
            <div><p className="text-2xl font-bold text-foreground">{assignments.length}</p><p className="text-[11px] text-muted-foreground">Atribuições ({activeAssignments} ativas)</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2"><Eye className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold text-foreground">{totalImpressions.toLocaleString('pt-BR')}</p><p className="text-[11px] text-muted-foreground">Impressões</p></div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2"><MousePointerClick className="h-5 w-5 text-orange-600" /></div>
            <div><p className="text-2xl font-bold text-foreground">{totalClicks.toLocaleString('pt-BR')}</p><p className="text-[11px] text-muted-foreground">Cliques ({totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0'}% CTR)</p></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="visual" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="visual">📍 Mapa Visual</TabsTrigger>
            <TabsTrigger value="slots">⚙️ Slots & Atribuições</TabsTrigger>
            <TabsTrigger value="metrics">📊 Métricas</TabsTrigger>
          </TabsList>

          {/* ====== VISUAL MAP TAB ====== */}
          <TabsContent value="visual" className="space-y-6">
            <p className="text-sm text-muted-foreground">Visualize onde cada slot aparece no site, seu tamanho e quantos patrocinadores estão atribuídos.</p>

            {Object.entries(slotsByPage).map(([pageType, pageSlots]) => {
              const pt = PAGE_TYPES.find(p => p.value === pageType);
              const Icon = pt?.icon || Globe;
              return (
                <div key={pageType} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold text-foreground text-lg">{pt?.label || pageType}</h2>
                    <Badge className={PAGE_TYPE_COLORS[pageType] || 'bg-muted text-muted-foreground'}>
                      {pageSlots.length} slot(s)
                    </Badge>
                  </div>

                  {/* Page wireframe */}
                  <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 space-y-2 relative">
                    {/* Wireframe header */}
                    <div className="h-6 rounded bg-muted flex items-center px-3">
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      </div>
                      <span className="text-[9px] text-muted-foreground ml-3 font-mono">precisodeum.lovable.app/{pageType === 'global' ? '...' : pageType}</span>
                    </div>
                    <div className="h-4 rounded bg-muted/60 w-3/4 mx-auto" /> {/* nav placeholder */}

                    {pageSlots.sort((a: any, b: any) => a.display_order - b.display_order).map((slot: any) => {
                      const visual = SLOT_VISUAL_MAP[slot.slug];
                      const SlotIcon = visual?.icon || LayoutGrid;
                      const slotAssigns = assignments.filter((a: any) => a.slot_id === slot.id);
                      const occupiedCount = slotAssigns.filter((a: any) => a.active).length;

                      return (
                        <div
                          key={slot.id}
                          className={`group relative rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                            slot.active
                              ? occupiedCount > 0
                                ? 'border-green-400 bg-green-50/50 dark:bg-green-950/20'
                                : 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                              : 'border-muted bg-muted/40 opacity-50'
                          } px-4 py-3`}
                          onClick={() => openEditSlot(slot)}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <SlotIcon className={`h-5 w-5 shrink-0 ${visual?.color || 'text-muted-foreground'}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm text-foreground">{slot.name}</span>
                                  <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{slot.slug}</code>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{visual?.preview || slot.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-[10px] font-medium text-muted-foreground">{visual?.size || '—'}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {occupiedCount > 0 ? (
                                    <Badge variant="default" className="text-[10px] h-5">{occupiedCount}/{slot.max_ads} ocupado(s)</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] h-5">Vazio</Badge>
                                  )}
                                  {!slot.active && <Badge variant="destructive" className="text-[10px] h-5">Desativado</Badge>}
                                </div>
                              </div>
                              {/* Sponsor avatars */}
                              {slotAssigns.length > 0 && (
                                <div className="flex -space-x-2">
                                  {slotAssigns.slice(0, 3).map((a: any) => {
                                    const img = getSponsorImage(a.sponsor_id);
                                    return img ? (
                                      <img key={a.id} src={img} alt="" className="h-7 w-7 rounded-full border-2 border-background object-cover" />
                                    ) : (
                                      <div key={a.id} className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                                        {getSponsorTitle(a.sponsor_id).charAt(0)}
                                      </div>
                                    );
                                  })}
                                  {slotAssigns.length > 3 && (
                                    <div className="h-7 w-7 rounded-full border-2 border-background bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground">
                                      +{slotAssigns.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Tooltip on hover - assigned sponsors list */}
                          {slotAssigns.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50 hidden group-hover:block">
                              <div className="flex flex-wrap gap-1.5">
                                {slotAssigns.map((a: any) => (
                                  <span key={a.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${a.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
                                    {getSponsorTitle(a.sponsor_id)}
                                    {a.target_city && <span className="opacity-60">({a.target_city})</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Wireframe footer */}
                    <div className="h-3 rounded bg-muted/60 w-1/2 mx-auto mt-2" />
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* ====== SLOTS & ASSIGNMENTS TAB ====== */}
          <TabsContent value="slots" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar slot..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <Select value={pageFilter} onValueChange={setPageFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Páginas</SelectItem>
                  {PAGE_TYPES.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {filteredSlots.map((slot: any) => {
                const slotAssignments = assignments.filter((a: any) => a.slot_id === slot.id);
                const visual = SLOT_VISUAL_MAP[slot.slug];

                return (
                  <Card key={slot.id} className={!slot.active ? 'opacity-60' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-sm">{slot.name}</CardTitle>
                          <Badge className={`text-[10px] ${PAGE_TYPE_COLORS[slot.page_type] || ''}`}>{slot.page_type}</Badge>
                          <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{slot.slug}</code>
                          {visual && <span className="text-[10px] text-muted-foreground">• {visual.size}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Máx: {slot.max_ads}</span>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditSlot(slot)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Switch checked={slot.active} onCheckedChange={active => toggleSlot.mutate({ id: slot.id, active })} />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { if (confirm('Excluir slot e todas as atribuições?')) deleteSlotMutation.mutate(slot.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{slot.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {slotAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {slotAssignments.map((a: any) => {
                            const key = `${a.sponsor_id}__${slot.slug}`;
                            const m = metricsSummary.get(key);
                            const sponsorImg = getSponsorImage(a.sponsor_id);
                            return (
                              <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {sponsorImg && <img src={sponsorImg} alt="" className="h-6 w-6 rounded object-cover" />}
                                  <span className="text-sm font-medium">{getSponsorTitle(a.sponsor_id)}</span>
                                  <Badge variant={a.active ? 'default' : 'secondary'} className="text-[10px]">
                                    {a.active ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                  {a.priority > 0 && <Badge variant="outline" className="text-[10px]">P{a.priority}</Badge>}
                                  {a.target_category && <Badge variant="outline" className="text-[10px]">Cat: {a.target_category}</Badge>}
                                  {a.target_city && <Badge variant="outline" className="text-[10px]">🏙 {a.target_city}</Badge>}
                                  {a.start_date && <span className="text-[10px] text-muted-foreground">{format(new Date(a.start_date), 'dd/MM/yy')}</span>}
                                  {a.end_date && <span className="text-[10px] text-muted-foreground">→ {format(new Date(a.end_date), 'dd/MM/yy')}</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                  {m && (
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{m.impressions.toLocaleString('pt-BR')}</span>
                                      <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" />{m.clicks.toLocaleString('pt-BR')}</span>
                                    </div>
                                  )}
                                  <Switch checked={a.active} onCheckedChange={active => toggleAssignment.mutate({ id: a.id, active })} />
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeAssignment.mutate(a.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-2">
                          <p className="text-xs text-muted-foreground">Nenhum patrocinador atribuído.</p>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAssignForm(prev => ({ ...prev, slot_id: slot.id })); setAssignDialog(true); }}>
                            <Plus className="h-3 w-3 mr-1" /> Atribuir
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {filteredSlots.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum slot encontrado</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ====== METRICS TAB ====== */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrocinador</TableHead>
                    <TableHead>Posição (Slot)</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(metricsSummary.entries())
                    .sort(([, a], [, b]) => b.impressions - a.impressions)
                    .map(([key, m]) => {
                      const [sponsorId, slotSlug] = key.split('__');
                      const ctr = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(1) : '0.0';
                      const sponsorImg = getSponsorImage(sponsorId);
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {sponsorImg && <img src={sponsorImg} alt="" className="h-6 w-6 rounded object-cover" />}
                              <span className="font-medium text-sm">{getSponsorTitle(sponsorId)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{slotSlug}</code>
                          </TableCell>
                          <TableCell className="text-right text-sm">{m.impressions.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right text-sm">{m.clicks.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{ctr}%</TableCell>
                        </TableRow>
                      );
                    })}
                  {metricsSummary.size === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma métrica registrada.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ====== SLOT CREATE/EDIT DIALOG ====== */}
      <Dialog open={slotDialog} onOpenChange={v => { if (!v) closeSlotDialog(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSlot ? 'Editar Slot' : 'Novo Slot de Anúncio'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveSlotMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={slotForm.name} onChange={e => setSlotForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Home - Topo" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={slotForm.slug} onChange={e => setSlotForm(p => ({ ...p, slug: e.target.value }))} placeholder="Ex: home-top" className="font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">Identificador único usado no código. Use letras minúsculas e hífens.</p>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={slotForm.description} onChange={e => setSlotForm(p => ({ ...p, description: e.target.value }))} placeholder="Onde este slot aparece e como é exibido" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Página</Label>
                <Select value={slotForm.page_type} onValueChange={v => setSlotForm(p => ({ ...p, page_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_TYPES.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Máx. Anúncios</Label>
                <Input type="number" value={slotForm.max_ads} onChange={e => setSlotForm(p => ({ ...p, max_ads: e.target.value }))} min="1" />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={slotForm.display_order} onChange={e => setSlotForm(p => ({ ...p, display_order: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeSlotDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveSlotMutation.isPending || !slotForm.name || !slotForm.slug}>
                {editingSlot ? 'Salvar' : 'Criar Slot'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====== ASSIGN DIALOG ====== */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir Patrocinador a Slot</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); assignMutation.mutate(); }} className="space-y-4">
            <div>
              <Label>Slot *</Label>
              <Select value={assignForm.slot_id} onValueChange={v => setAssignForm(p => ({ ...p, slot_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar slot" /></SelectTrigger>
                <SelectContent>
                  {slots.filter((s: any) => s.active).map((s: any) => {
                    const assignCount = assignments.filter((a: any) => a.slot_id === s.id && a.active).length;
                    return (
                      <SelectItem key={s.id} value={s.id} disabled={assignCount >= s.max_ads}>
                        {s.name} ({s.page_type}) {assignCount >= s.max_ads ? '— LOTADO' : `${assignCount}/${s.max_ads}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Patrocinador *</Label>
              <Select value={assignForm.sponsor_id} onValueChange={v => setAssignForm(p => ({ ...p, sponsor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar patrocinador" /></SelectTrigger>
                <SelectContent>
                  {sponsors.filter((s: any) => s.active).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.title} ({s.tier})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Prioridade</Label><Input type="number" value={assignForm.priority} onChange={e => setAssignForm(p => ({ ...p, priority: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={assignForm.start_date} onChange={e => setAssignForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Fim</Label><Input type="date" value={assignForm.end_date} onChange={e => setAssignForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Categoria</Label><Input placeholder="ex: eletricista" value={assignForm.target_category} onChange={e => setAssignForm(p => ({ ...p, target_category: e.target.value }))} /></div>
              <div><Label>Cidade</Label><Input placeholder="ex: São Paulo" value={assignForm.target_city} onChange={e => setAssignForm(p => ({ ...p, target_city: e.target.value }))} /></div>
              <div><Label>Estado</Label><Input placeholder="ex: SP" value={assignForm.target_state} onChange={e => setAssignForm(p => ({ ...p, target_state: e.target.value }))} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAssignDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={assignMutation.isPending || !assignForm.slot_id || !assignForm.sponsor_id}>Atribuir</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAdSlotsPage;
