import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import {
  Plus, Pencil, Trash2, ExternalLink, CalendarIcon, Eye, MousePointerClick, Search,
  Megaphone, Users, FileText, StickyNote, AlertTriangle, TrendingUp, Settings2,
  Link2, Globe, MapPin, Building2, Phone, Mail, Star, Crown, Zap,
  PanelTop, Columns, Monitor, BarChart3, ArrowRight, Image as ImageIcon, Filter,
  Download, Bell, Power, Activity, Send, Heart, HeartCrack, Gauge
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ImageUploadField from '@/components/ImageUploadField';
import SponsorImage, { shapeLabelPt, type BannerShape } from '@/components/SponsorImage';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';
const PAGE_SIZE = 20;

/* ─── Visual position map — from central config ─── */
import { POSITION_CONFIG, POSITION_KEYS } from '@/config/sponsorPositions';

const POSITION_MAP: Record<string, { icon: any; color: string; size: string; where: string }> = Object.fromEntries(
  POSITION_KEYS.map(key => {
    const c = POSITION_CONFIG[key];
    return [key, { icon: c.icon, color: c.color, size: c.dimensions, where: c.description }];
  })
);

const TIER_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  basic:    { label: 'Básico',    color: 'bg-muted text-muted-foreground',      icon: Zap },
  destaque: { label: 'Destaque',  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Star },
  premium:  { label: 'Premium',   color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Crown },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  global:   { label: 'Global',    color: 'bg-primary/10 text-primary' },
  city:     { label: 'Cidade',    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  category: { label: 'Categoria', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
};

interface Sponsor {
  id: string; title: string; company_name: string; image_url: string | null; logo_url: string;
  link_url: string | null; position: string; active: boolean; display_order: number;
  created_at: string; start_date: string | null; end_date: string | null;
  impressions: number; clicks: number; sponsor_type: string; short_description: string;
  full_description: string; phone: string; whatsapp: string; external_link: string;
  linked_city: string; linked_category: string; plan_tier: string; badge_type: string;
  status: string; tier: string; ad_format: string; max_width: number; max_height: number;
  target_pages: string;
}

const emptyForm = {
  title: '', company_name: '', image_url: '', logo_url: '', link_url: '', position: 'banner',
  active: true, display_order: 0, start_date: '' as string, end_date: '' as string,
  tier: 'basic', ad_format: 'auto', max_width: 0, max_height: 0, target_pages: 'all',
  sponsor_type: 'global', short_description: '', full_description: '',
  phone: '', whatsapp: '', external_link: '', linked_city: '', linked_category: '',
  plan_tier: 'basic', badge_type: 'Patrocinado', status: 'active',
};

const PERM_LABELS: Record<string, string> = {
  banners: 'Meus Banners', campanhas: 'Campanhas', metricas: 'Métricas',
  contratos: 'Contratos', notificacoes: 'Notificações', dados: 'Meus Dados',
};

const AdminSponsorsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const loading = authLoading || adminLoading;

  useEffect(() => {
    if (!loading && !(!!user && isAdmin)) navigate('/', { replace: true });
  }, [!!user && isAdmin, loading, navigate]);

  // ── Data ──
  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['admin-sponsors'],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('sponsors').select('*').is('deleted_at', null).order('display_order');
      return (data || []) as Sponsor[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['admin-sponsor-contacts'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_contacts' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['admin-sponsor-campaigns'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_campaigns' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['admin-sponsor-contracts'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_contracts' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['admin-sponsor-notes'],
    queryFn: async () => {
      const { data } = await supabase.from('sponsor_notes' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['admin-sponsor-metrics-30d'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const { data } = await supabase.from('sponsor_metrics' as any).select('*').gte('event_date', thirtyDaysAgo);
      return (data || []) as any[];
    },
  });

  // ── State ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detectedShape, setDetectedShape] = useState<{ width: number; height: number; shape: BannerShape } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [detailSponsor, setDetailSponsor] = useState<Sponsor | null>(null);

  // CRM dialogs
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkForm, setLinkForm] = useState({ sponsor_id: '', user_email: '', company_name: '', contact_name: '', phone: '' });
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ sponsor_id: '', name: '', description: '', status: 'draft', start_date: '', end_date: '', budget: '' });
  const [contractDialog, setContractDialog] = useState(false);
  const [contractForm, setContractForm] = useState({ sponsor_id: '', contract_number: '', status: 'draft', start_date: '', end_date: '', value: '', notes: '' });
  const [noteDialog, setNoteDialog] = useState(false);
  const [noteForm, setNoteForm] = useState({ sponsor_id: '', content: '' });
  const [permDialog, setPermDialog] = useState(false);
  const [permContact, setPermContact] = useState<any>(null);

  // ── Bulk ──
  const bulk = useAdminBulkActions({
    table: 'sponsors', resourceType: 'sponsor',
    onComplete: () => { qc.invalidateQueries({ queryKey: ['admin-sponsors'] }); },
  });

  // ── Computed ──
  const alerts = useMemo(() => {
    const items: { type: string; msg: string; id: string; title: string }[] = [];
    const now = new Date();
    sponsors.forEach(s => {
      if (s.end_date) {
        const diff = differenceInDays(new Date(s.end_date), now);
        if (diff < 0) items.push({ type: 'expired', msg: `Expirado há ${Math.abs(diff)}d`, id: s.id, title: s.title });
        else if (diff <= 7) items.push({ type: 'expiring', msg: `Expira em ${diff}d`, id: s.id, title: s.title });
      }
      if (!s.active) items.push({ type: 'inactive', msg: 'Inativo', id: s.id, title: s.title });
    });
    return items;
  }, [sponsors]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sponsors.filter(s => {
      if (q && !s.title.toLowerCase().includes(q) && !(s.company_name || '').toLowerCase().includes(q)) return false;
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (statusFilter === 'expired' && !(s.end_date && new Date(s.end_date) < new Date())) return false;
      if (tierFilter !== 'all' && (s.tier || s.plan_tier) !== tierFilter) return false;
      if (typeFilter !== 'all' && s.sponsor_type !== typeFilter) return false;
      return true;
    });
  }, [sponsors, search, statusFilter, tierFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalImpressions = sponsors.reduce((a, s) => a + s.impressions, 0);
  const totalClicks = sponsors.reduce((a, s) => a + s.clicks, 0);
  const activeCount = sponsors.filter(s => s.active).length;
  const revenue = contracts.reduce((a: number, c: any) => a + (c.value || 0), 0);

  // per-sponsor metrics from last 30 days
  const metricsMap = useMemo(() => {
    const m = new Map<string, { imp: number; clk: number }>();
    metrics.forEach((row: any) => {
      const e = m.get(row.sponsor_id) || { imp: 0, clk: 0 };
      if (row.event_type === 'impression') e.imp += row.count;
      else if (row.event_type === 'click') e.clk += row.count;
      m.set(row.sponsor_id, e);
    });
    return m;
  }, [metrics]);

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title, company_name: form.company_name,
        image_url: form.image_url || null, logo_url: form.logo_url || '',
        link_url: form.link_url || null, position: form.position,
        active: form.active, display_order: form.display_order,
        start_date: form.start_date || null, end_date: form.end_date || null,
        tier: form.tier, ad_format: form.ad_format,
        max_width: form.max_width || 0, max_height: form.max_height || 0,
        target_pages: form.target_pages || 'all',
        sponsor_type: form.sponsor_type, short_description: form.short_description,
        full_description: form.full_description, phone: form.phone, whatsapp: form.whatsapp,
        external_link: form.external_link, linked_city: form.linked_city,
        linked_category: form.linked_category, plan_tier: form.plan_tier,
        badge_type: form.badge_type, status: form.status,
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
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      toast({ title: editingId ? 'Patrocinador atualizado' : 'Patrocinador criado' });
      closeDialog();
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const handleSoftDelete = async (id: string) => {
    if (!confirm('Mover para lixeira?')) return;
    await supabase.from('sponsors').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
    await logAuditAction({ action: 'soft_delete', resource_type: 'sponsor', resource_id: id });
    qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
    toast({ title: 'Movido para lixeira' });
  };

  const linkMutation = useMutation({
    mutationFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, email').eq('email', linkForm.user_email).limit(1);
      if (!profiles || profiles.length === 0) throw new Error('Usuário não encontrado');
      const { error } = await supabase.from('sponsor_contacts' as any).insert({
        sponsor_id: linkForm.sponsor_id, user_id: profiles[0].id,
        company_name: linkForm.company_name, contact_name: linkForm.contact_name,
        phone: linkForm.phone, email: linkForm.user_email,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-contacts'] });
      toast({ title: 'Patrocinador vinculado ao usuário!' });
      setLinkDialog(false);
      setLinkForm({ sponsor_id: '', user_email: '', company_name: '', contact_name: '', phone: '' });
    },
    onError: (e: any) => toast({ title: e.message || 'Erro', variant: 'destructive' }),
  });

  const campaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sponsor_campaigns' as any).insert({
        sponsor_id: campaignForm.sponsor_id, name: campaignForm.name,
        description: campaignForm.description, status: campaignForm.status,
        start_date: campaignForm.start_date || null, end_date: campaignForm.end_date || null,
        budget: campaignForm.budget ? Number(campaignForm.budget) : 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] });
      toast({ title: 'Campanha criada!' });
      setCampaignDialog(false);
    },
  });

  const contractMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sponsor_contracts' as any).insert({
        sponsor_id: contractForm.sponsor_id, contract_number: contractForm.contract_number,
        status: contractForm.status, start_date: contractForm.start_date || null,
        end_date: contractForm.end_date || null, value: contractForm.value ? Number(contractForm.value) : 0,
        notes: contractForm.notes,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-contracts'] });
      toast({ title: 'Contrato criado!' });
      setContractDialog(false);
    },
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error('Não autenticado');
      const { error } = await supabase.from('sponsor_notes' as any).insert({
        sponsor_id: noteForm.sponsor_id, author_id: u.id, content: noteForm.content,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsor-notes'] });
      toast({ title: 'Nota adicionada!' });
      setNoteDialog(false);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('sponsor_contacts' as any).delete().eq('id', id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sponsor-contacts'] }); toast({ title: 'Vínculo removido' }); },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('sponsor_campaigns' as any).delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsor-campaigns'] }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('sponsor_contracts' as any).delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsor-contracts'] }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from('sponsor_notes' as any).delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsor-notes'] }),
  });

  const updatePermMutation = useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: any }) => {
      const { error } = await supabase.from('sponsor_contacts' as any).update({ permissions } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sponsor-contacts'] }); toast({ title: 'Permissões atualizadas!' }); },
  });

  // ── Helpers ──
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); setDetectedShape(null); };
  const openEdit = (s: Sponsor) => {
    setEditingId(s.id);
    setForm({
      title: s.title, company_name: s.company_name || '', image_url: s.image_url || '',
      logo_url: s.logo_url || '', link_url: s.link_url || '', position: s.position,
      active: s.active, display_order: s.display_order, start_date: s.start_date || '',
      end_date: s.end_date || '', tier: s.tier || 'basic', ad_format: s.ad_format || 'auto',
      max_width: s.max_width || 0, max_height: s.max_height || 0, target_pages: s.target_pages || 'all',
      sponsor_type: s.sponsor_type || 'global', short_description: s.short_description || '',
      full_description: s.full_description || '', phone: s.phone || '', whatsapp: s.whatsapp || '',
      external_link: s.external_link || '', linked_city: s.linked_city || '',
      linked_category: s.linked_category || '', plan_tier: s.plan_tier || 'basic',
      badge_type: s.badge_type || 'Patrocinado', status: s.status || 'active',
    });
    setDialogOpen(true);
  };
  const getSponsorTitle = (id: string) => sponsors.find(s => s.id === id)?.title || id.slice(0, 8);
  const getContactsFor = (id: string) => contacts.filter((c: any) => c.sponsor_id === id);
  const getCampaignsFor = (id: string) => campaigns.filter((c: any) => c.sponsor_id === id);
  const getContractsFor = (id: string) => contracts.filter((c: any) => c.sponsor_id === id);
  const getNotesFor = (id: string) => notes.filter((n: any) => n.sponsor_id === id);

  const SponsorSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecionar patrocinador" /></SelectTrigger>
      <SelectContent>{sponsors.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
    </Select>
  );

  if (loading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Patrocinadores</h1>
            <p className="text-sm text-muted-foreground">Painel completo: cadastro, vínculos, campanhas, contratos e métricas</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setLinkForm({ sponsor_id: '', user_email: '', company_name: '', contact_name: '', phone: '' }); setLinkDialog(true); }}>
              <Link2 className="h-4 w-4 mr-1" /> Vincular Usuário
            </Button>
            <Button size="sm" onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Patrocinador
            </Button>
          </div>
        </div>

        {/* ── Alerts ── */}
        {alerts.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">Alertas ({alerts.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {alerts.slice(0, 8).map((a, i) => (
                  <Badge key={i} variant={a.type === 'expired' ? 'destructive' : 'secondary'} className="text-[10px] cursor-pointer"
                    onClick={() => { const s = sponsors.find(x => x.id === a.id); if (s) setDetailSponsor(s); }}>
                    {a.title}: {a.msg}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── KPIs ── */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Megaphone, label: 'Patrocinadores', value: sponsors.length, sub: `${activeCount} ativos` },
            { icon: Users, label: 'Vínculos', value: contacts.length, sub: 'Usuários associados' },
            { icon: TrendingUp, label: 'Campanhas', value: campaigns.length, sub: `${campaigns.filter((c: any) => c.status === 'active').length} ativas` },
            { icon: FileText, label: 'Contratos', value: contracts.length, sub: `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` },
            { icon: Eye, label: 'Impressões', value: totalImpressions.toLocaleString('pt-BR'), sub: 'Total acumulado' },
            { icon: MousePointerClick, label: 'Cliques', value: totalClicks.toLocaleString('pt-BR'), sub: `${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0'}% CTR` },
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

        {/* ── Tabs ── */}
        <Tabs defaultValue="sponsors" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="sponsors">📋 Patrocinadores</TabsTrigger>
            <TabsTrigger value="visual">📍 Mapa de Posições</TabsTrigger>
            <TabsTrigger value="links">🔗 Vínculos</TabsTrigger>
            <TabsTrigger value="campaigns">📢 Campanhas</TabsTrigger>
            <TabsTrigger value="contracts">📄 Contratos</TabsTrigger>
            <TabsTrigger value="notes">📝 Notas</TabsTrigger>
          </TabsList>

          {/* ═══ SPONSORS TAB ═══ */}
          <TabsContent value="sponsors" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={v => { setTierFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Planos</SelectItem>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="destaque">Destaque</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="city">Cidade</SelectItem>
                  <SelectItem value="category">Categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulk.hasSelection && (
              <BulkActionsBar count={bulk.selectionCount} onClear={bulk.clearSelection} onDelete={bulk.bulkSoftDelete}
                onExport={() => bulk.exportSelected(filtered, 'patrocinadores')} loading={bulk.bulkLoading}>
                <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ active: true })} className="text-green-600 border-green-200">Ativar</Button>
                <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ active: false })} className="text-amber-600 border-amber-200">Desativar</Button>
              </BulkActionsBar>
            )}

            {/* Cards grid */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl border border-border bg-muted/30 animate-pulse" />
              )) : paginated.map(s => {
                const expired = s.end_date && new Date(s.end_date) < new Date();
                const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(1) : '0.0';
                const tierCfg = TIER_CONFIG[s.tier || s.plan_tier] || TIER_CONFIG.basic;
                const typeCfg = TYPE_CONFIG[s.sponsor_type] || TYPE_CONFIG.global;
                const pos = POSITION_MAP[s.position];
                const PosIcon = pos?.icon || ImageIcon;
                const hasContact = contacts.some((c: any) => c.sponsor_id === s.id);
                const m30 = metricsMap.get(s.id);

                return (
                  <div key={s.id} className={cn(
                    'group relative rounded-xl border bg-card shadow-card transition-all hover:shadow-card-hover',
                    !s.active ? 'opacity-60 border-muted' : expired ? 'border-destructive/30' : 'border-border',
                    bulk.selectedIds.has(s.id) && 'ring-2 ring-accent'
                  )}>
                    {/* Selection */}
                    <div className="absolute top-3 left-3 z-10">
                      <SelectionCheckbox checked={bulk.selectedIds.has(s.id)} onCheckedChange={() => bulk.toggleSelection(s.id)} />
                    </div>

                    {/* Banner preview */}
                    {s.image_url ? (
                      <div className="relative h-24 overflow-hidden rounded-t-xl bg-muted">
                        <img src={s.image_url} alt={s.title} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                        {/* Position badge */}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1">
                          <PosIcon className={cn('h-3.5 w-3.5', pos?.color || 'text-muted-foreground')} />
                          <span className="text-[9px] font-medium text-foreground bg-background/80 px-1.5 py-0.5 rounded">
                            {pos?.size || s.position}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-16 rounded-t-xl bg-muted/50 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-3 cursor-pointer" onClick={() => setDetailSponsor(s)}>
                      <div className="flex items-start gap-2">
                        {s.logo_url ? (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={s.logo_url} />
                            <AvatarFallback>{s.title[0]}</AvatarFallback>
                          </Avatar>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-foreground truncate">{s.title}</p>
                          {s.company_name && <p className="text-[10px] text-muted-foreground truncate">{s.company_name}</p>}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge className={cn('text-[10px]', tierCfg.color)}>
                          <tierCfg.icon className="h-2.5 w-2.5 mr-0.5" /> {tierCfg.label}
                        </Badge>
                        <Badge className={cn('text-[10px]', typeCfg.color)}>{typeCfg.label}</Badge>
                        <Badge variant={expired ? 'destructive' : s.active ? 'default' : 'secondary'} className="text-[10px]">
                          {expired ? '🔴 Expirado' : s.active ? '🟢 Ativo' : '⏸️ Inativo'}
                        </Badge>
                        {hasContact && <Badge variant="outline" className="text-[10px] text-accent"><Link2 className="h-2.5 w-2.5 mr-0.5" /> Vinculado</Badge>}
                      </div>

                      {/* Context info */}
                      {(s.linked_city || s.linked_category) && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          {s.linked_city && <><MapPin className="h-2.5 w-2.5" /> {s.linked_city}</>}
                          {s.linked_category && <><span className="mx-1">•</span> {s.linked_category}</>}
                        </p>
                      )}

                      {/* Metrics row */}
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {s.impressions.toLocaleString('pt-BR')}</span>
                        <span className="flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" /> {s.clicks.toLocaleString('pt-BR')}</span>
                        <span className="font-medium">{ctr}% CTR</span>
                        {m30 && (
                          <span className="ml-auto flex items-center gap-0.5 text-accent">
                            <BarChart3 className="h-3 w-3" /> 30d: {m30.imp}i/{m30.clk}c
                          </span>
                        )}
                      </div>

                      {/* Period */}
                      <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {s.start_date ? format(new Date(s.start_date), 'dd/MM/yy') : '—'}
                        {' → '}
                        {s.end_date ? format(new Date(s.end_date), 'dd/MM/yy') : '∞'}
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="border-t border-border px-3 py-1.5 flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => openEdit(s)}>
                        <Pencil className="h-3 w-3" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 flex-1" onClick={() => {
                        setLinkForm(p => ({ ...p, sponsor_id: s.id })); setLinkDialog(true);
                      }}>
                        <Link2 className="h-3 w-3" /> Vincular
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => handleSoftDelete(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && !isLoading && (
              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum patrocinador encontrado</p>
              </div>
            )}

            {totalPages > 1 && <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />}
          </TabsContent>

          {/* ═══ VISUAL MAP TAB ═══ */}
          <TabsContent value="visual" className="space-y-4">
            <p className="text-sm text-muted-foreground">Visualize onde cada posição aparece no site e quais patrocinadores estão ocupando.</p>

            {/* Wireframe illustration */}
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-4 space-y-2">
              <div className="h-6 rounded bg-muted flex items-center px-3">
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                </div>
                <span className="text-[9px] text-muted-foreground ml-3 font-mono">precisodeum.lovable.app</span>
              </div>
              <div className="h-4 rounded bg-muted/50 w-2/3 mx-auto" />

              {Object.entries(POSITION_MAP).map(([slug, info]) => {
                const PIcon = info.icon;
                const occupying = sponsors.filter(s => s.position === slug && s.active);
                return (
                  <div key={slug} className={cn(
                    'rounded-lg border-2 px-4 py-2.5 transition-all',
                    occupying.length > 0
                      ? 'border-green-400/60 bg-green-50/30 dark:bg-green-950/10'
                      : 'border-muted bg-muted/20'
                  )}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <PIcon className={cn('h-4 w-4 shrink-0', info.color)} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-foreground">{slug}</span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{info.size}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{info.where}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {occupying.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="default" className="text-[10px]">{occupying.length} ativo(s)</Badge>
                            <div className="flex -space-x-2">
                              {occupying.slice(0, 3).map(s => s.image_url ? (
                                <img key={s.id} src={s.image_url} className="h-6 w-6 rounded-full border-2 border-background object-cover" />
                              ) : (
                                <div key={s.id} className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold">
                                  {s.title[0]}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Vazio</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="h-3 rounded bg-muted/40 w-1/2 mx-auto mt-2" />
            </div>
          </TabsContent>

          {/* ═══ LINKS TAB ═══ */}
          <TabsContent value="links" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Vínculos Patrocinador ↔ Usuário</h2>
              <Button size="sm" onClick={() => setLinkDialog(true)}><Plus className="h-4 w-4 mr-1" /> Vincular</Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {contacts.map((c: any) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-xs">{(c.contact_name || '?')[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{c.contact_name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-2.5 w-2.5" /> {getSponsorTitle(c.sponsor_id)}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Mail className="h-2.5 w-2.5" /> {c.email || '—'}
                      </p>
                      {c.phone && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {c.phone}</p>}
                      <div className="mt-1.5 flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {Object.values(c.permissions || {}).filter(Boolean).length}/{Object.keys(PERM_LABELS).length} permissões
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs flex-1 gap-1" onClick={() => { setPermContact(c); setPermDialog(true); }}>
                      <Settings2 className="h-3 w-3" /> Permissões
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => unlinkMutation.mutate(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {contacts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum vínculo cadastrado</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══ CAMPAIGNS TAB ═══ */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Campanhas</h2>
              <Button size="sm" onClick={() => setCampaignDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nova Campanha</Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground">{getSponsorTitle(c.sponsor_id)}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">{c.status}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {c.start_date ? format(new Date(c.start_date), 'dd/MM/yy') : '—'} → {c.end_date ? format(new Date(c.end_date), 'dd/MM/yy') : '—'}
                          </span>
                        </div>
                        {c.budget > 0 && <p className="text-xs mt-1 font-medium">R$ {Number(c.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteCampaignMutation.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {campaigns.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma campanha</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══ CONTRACTS TAB ═══ */}
          <TabsContent value="contracts" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Contratos</h2>
              <Button size="sm" onClick={() => setContractDialog(true)}><Plus className="h-4 w-4 mr-1" /> Novo Contrato</Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {contracts.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">{getSponsorTitle(c.sponsor_id)}</p>
                        <p className="text-[10px] text-muted-foreground">Nº {c.contract_number || '—'}</p>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">{c.status}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {c.start_date ? format(new Date(c.start_date), 'dd/MM/yy') : '—'} → {c.end_date ? format(new Date(c.end_date), 'dd/MM/yy') : '—'}
                          </span>
                        </div>
                        {c.value > 0 && <p className="text-xs mt-1 font-medium">R$ {Number(c.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteContractMutation.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {contracts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum contrato</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ═══ NOTES TAB ═══ */}
          <TabsContent value="notes" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Notas Internas</h2>
              <Button size="sm" onClick={() => setNoteDialog(true)}><Plus className="h-4 w-4 mr-1" /> Nova Nota</Button>
            </div>
            <div className="space-y-3">
              {notes.map((n: any) => (
                <Card key={n.id}>
                  <CardContent className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StickyNote className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-medium">{getSponsorTitle(n.sponsor_id)}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), 'dd/MM/yy HH:mm')}</span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => deleteNoteMutation.mutate(n.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {notes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma nota</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ SPONSOR DETAIL SHEET ═══ */}
      <Sheet open={!!detailSponsor} onOpenChange={v => { if (!v) setDetailSponsor(null); }}>
        <SheetContent className="w-[95vw] max-w-lg overflow-y-auto">
          {detailSponsor && (() => {
            const s = detailSponsor;
            const tierCfg = TIER_CONFIG[s.tier || s.plan_tier] || TIER_CONFIG.basic;
            const typeCfg = TYPE_CONFIG[s.sponsor_type] || TYPE_CONFIG.global;
            const pos = POSITION_MAP[s.position];
            const sContacts = getContactsFor(s.id);
            const sCampaigns = getCampaignsFor(s.id);
            const sContracts = getContractsFor(s.id);
            const sNotes = getNotesFor(s.id);
            const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(1) : '0.0';
            const m30 = metricsMap.get(s.id);

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {s.logo_url && <Avatar className="h-8 w-8"><AvatarImage src={s.logo_url} /><AvatarFallback>{s.title[0]}</AvatarFallback></Avatar>}
                    <span>{s.title}</span>
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-4">
                  {/* Banner preview */}
                  {s.image_url && (
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img src={s.image_url} alt={s.title} className="w-full object-cover max-h-40" />
                    </div>
                  )}

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground text-xs">Empresa</span><p className="font-medium">{s.company_name || '—'}</p></div>
                    <div><span className="text-muted-foreground text-xs">Status</span>
                      <Badge variant={s.active ? 'default' : 'destructive'} className="text-[10px]">{s.active ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <div><span className="text-muted-foreground text-xs">Plano</span><Badge className={cn('text-[10px]', tierCfg.color)}>{tierCfg.label}</Badge></div>
                    <div><span className="text-muted-foreground text-xs">Tipo</span><Badge className={cn('text-[10px]', typeCfg.color)}>{typeCfg.label}</Badge></div>
                    <div><span className="text-muted-foreground text-xs">Posição</span><p className="text-xs">{pos?.where || s.position} <span className="text-muted-foreground">({pos?.size || '—'})</span></p></div>
                    <div><span className="text-muted-foreground text-xs">Badge</span><p className="text-xs">{s.badge_type}</p></div>
                    <div><span className="text-muted-foreground text-xs">Período</span>
                      <p className="text-xs">{s.start_date ? format(new Date(s.start_date), 'dd/MM/yy') : '—'} → {s.end_date ? format(new Date(s.end_date), 'dd/MM/yy') : '∞'}</p>
                    </div>
                    <div><span className="text-muted-foreground text-xs">Ordem</span><p className="text-xs">{s.display_order}</p></div>
                  </div>

                  {(s.linked_city || s.linked_category) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {s.linked_city && <><MapPin className="h-3 w-3" /> {s.linked_city}</>}
                      {s.linked_category && <><Globe className="h-3 w-3 ml-2" /> {s.linked_category}</>}
                    </div>
                  )}

                  {s.short_description && <p className="text-sm text-muted-foreground">{s.short_description}</p>}

                  {/* Contact info */}
                  {(s.phone || s.whatsapp || s.external_link) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</span>}
                      {s.whatsapp && <span className="flex items-center gap-1">📱 {s.whatsapp}</span>}
                      {s.external_link && <a href={s.external_link} target="_blank" className="flex items-center gap-1 text-primary"><ExternalLink className="h-3 w-3" /> Link</a>}
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="rounded-lg border border-border p-3 grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-lg font-bold">{s.impressions.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">Impressões</p></div>
                    <div><p className="text-lg font-bold">{s.clicks.toLocaleString('pt-BR')}</p><p className="text-[10px] text-muted-foreground">Cliques</p></div>
                    <div><p className="text-lg font-bold">{ctr}%</p><p className="text-[10px] text-muted-foreground">CTR</p></div>
                  </div>
                  {m30 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" /> Últimos 30 dias: {m30.imp} impressões, {m30.clk} cliques
                    </p>
                  )}

                  {/* Linked users */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Usuários Vinculados ({sContacts.length})</h3>
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setLinkForm(p => ({ ...p, sponsor_id: s.id })); setLinkDialog(true); }}>
                        <Plus className="h-3 w-3 mr-0.5" /> Vincular
                      </Button>
                    </div>
                    {sContacts.length > 0 ? sContacts.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 mb-1.5">
                        <div>
                          <p className="text-xs font-medium">{c.contact_name || '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{c.email || '—'} • {c.phone || '—'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setPermContact(c); setPermDialog(true); }}>
                            <Settings2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => unlinkMutation.mutate(c.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )) : <p className="text-xs text-muted-foreground">Nenhum usuário vinculado</p>}
                  </div>

                  {/* Campaigns */}
                  {sCampaigns.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-1.5">📢 Campanhas ({sCampaigns.length})</h3>
                      {sCampaigns.map((c: any) => (
                        <div key={c.id} className="text-xs border-b border-border py-1.5 flex justify-between">
                          <span>{c.name} <Badge variant="secondary" className="text-[9px] ml-1 capitalize">{c.status}</Badge></span>
                          {c.budget > 0 && <span className="text-muted-foreground">R$ {Number(c.budget).toLocaleString('pt-BR')}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contracts */}
                  {sContracts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-1.5">📄 Contratos ({sContracts.length})</h3>
                      {sContracts.map((c: any) => (
                        <div key={c.id} className="text-xs border-b border-border py-1.5 flex justify-between">
                          <span>Nº {c.contract_number || '—'} <Badge variant="secondary" className="text-[9px] ml-1 capitalize">{c.status}</Badge></span>
                          {c.value > 0 && <span className="text-muted-foreground">R$ {Number(c.value).toLocaleString('pt-BR')}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {sNotes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-1.5">📝 Notas ({sNotes.length})</h3>
                      {sNotes.map((n: any) => (
                        <div key={n.id} className="text-xs border-b border-border py-1.5">
                          <span className="text-muted-foreground">{format(new Date(n.created_at), 'dd/MM HH:mm')}</span> — {n.content}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { openEdit(s); setDetailSponsor(null); }}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setNoteForm({ sponsor_id: s.id, content: '' }); setNoteDialog(true); }}>
                      <StickyNote className="h-3 w-3 mr-1" /> Nota
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setCampaignForm({ sponsor_id: s.id, name: '', description: '', status: 'draft', start_date: '', end_date: '', budget: '' }); setCampaignDialog(true); }}>
                      <TrendingUp className="h-3 w-3 mr-1" /> Campanha
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ═══ CREATE/EDIT DIALOG ═══ */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] max-w-lg sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Patrocinador' : 'Novo Patrocinador'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
              <div><Label>Empresa</Label><Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Tipo de Patrocínio</Label>
                <Select value={form.sponsor_type} onValueChange={v => setForm({ ...form, sponsor_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="city">Cidade</SelectItem>
                    <SelectItem value="category">Categoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Plano</Label>
                <Select value={form.plan_tier} onValueChange={v => setForm({ ...form, plan_tier: v, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Básico</SelectItem>
                    <SelectItem value="destaque">Destaque</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.sponsor_type === 'city' && <div><Label>Cidade</Label><Input value={form.linked_city} onChange={e => setForm({ ...form, linked_city: e.target.value })} /></div>}
            {form.sponsor_type === 'category' && <div><Label>Categoria (slug)</Label><Input value={form.linked_category} onChange={e => setForm({ ...form, linked_category: e.target.value })} /></div>}
            <div><Label>Descrição Curta</Label><Input value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value.slice(0, 120) })} maxLength={120} /></div>
            <div><Label>Descrição Completa</Label><Textarea value={form.full_description} onChange={e => setForm({ ...form, full_description: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Link Externo</Label><Input value={form.external_link} onChange={e => setForm({ ...form, external_link: e.target.value })} /></div>
              <div><Label>Badge</Label><Input value={form.badge_type} onChange={e => setForm({ ...form, badge_type: e.target.value })} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Logo</Label><ImageUploadField value={form.logo_url} onChange={url => setForm({ ...form, logo_url: url })} bucket="sponsors" folder="logos" /></div>
            <div>
              <Label>Banner / Imagem</Label>
              <ImageUploadField value={form.image_url} onChange={url => setForm({ ...form, image_url: url })} bucket="sponsors" folder="banners" />
              {POSITION_MAP[form.position] && (
                <p className="text-[10px] text-muted-foreground mt-1">📐 Tamanho ideal: {POSITION_MAP[form.position].size} — {POSITION_MAP[form.position].where}</p>
              )}
              {form.image_url && (
                <div className="mt-2 rounded-lg border border-border overflow-hidden">
                  <SponsorImage src={form.image_url} alt="Preview" onDimensionsDetected={(w, h, shape) => setDetectedShape({ width: w, height: h, shape })} />
                  {detectedShape && <p className="text-[10px] text-muted-foreground px-2 py-1 bg-muted/30">{detectedShape.width}×{detectedShape.height}px • {shapeLabelPt[detectedShape.shape]}</p>}
                </div>
              )}
            </div>
            <div><Label>URL do Link</Label><Input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} /></div>
            <div><Label>Posição</Label>
              <Select value={form.position} onValueChange={v => setForm({ ...form, position: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POSITION_MAP).map(([key, info]) => (
                    <SelectItem key={key} value={key}>{key} ({info.size}) — {info.where}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(new Date(form.start_date), 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.start_date ? new Date(form.start_date) : undefined}
                      onSelect={d => setForm({ ...form, start_date: d ? format(d, 'yyyy-MM-dd') : '' })} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div><Label>Data Término</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.end_date ? format(new Date(form.end_date), 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.end_date ? new Date(form.end_date) : undefined}
                      onSelect={d => setForm({ ...form, end_date: d ? format(d, 'yyyy-MM-dd') : '' })} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ordem</Label><Input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: Number(e.target.value) })} /></div>
              <div className="flex items-end gap-2 pb-0.5"><Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ LINK DIALOG ═══ */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vincular Patrocinador a Usuário</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); linkMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={linkForm.sponsor_id} onChange={v => setLinkForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>E-mail do Usuário *</Label><Input required type="email" value={linkForm.user_email} onChange={e => setLinkForm(p => ({ ...p, user_email: e.target.value }))} placeholder="usuario@email.com" /></div>
            <div><Label>Nome do Contato</Label><Input value={linkForm.contact_name} onChange={e => setLinkForm(p => ({ ...p, contact_name: e.target.value }))} /></div>
            <div><Label>Empresa</Label><Input value={linkForm.company_name} onChange={e => setLinkForm(p => ({ ...p, company_name: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={linkForm.phone} onChange={e => setLinkForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLinkDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={linkMutation.isPending}>Vincular</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ CAMPAIGN DIALOG ═══ */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); campaignMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={campaignForm.sponsor_id} onChange={v => setCampaignForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>Nome *</Label><Input required value={campaignForm.name} onChange={e => setCampaignForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={campaignForm.description} onChange={e => setCampaignForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Status</Label>
              <Select value={campaignForm.status} onValueChange={v => setCampaignForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem><SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem><SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Fim</Label><Input type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div><Label>Orçamento (R$)</Label><Input type="number" step="0.01" value={campaignForm.budget} onChange={e => setCampaignForm(p => ({ ...p, budget: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCampaignDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={campaignMutation.isPending}>Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ CONTRACT DIALOG ═══ */}
      <Dialog open={contractDialog} onOpenChange={setContractDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); contractMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={contractForm.sponsor_id} onChange={v => setContractForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>Nº Contrato</Label><Input value={contractForm.contract_number} onChange={e => setContractForm(p => ({ ...p, contract_number: e.target.value }))} /></div>
            <div><Label>Status</Label>
              <Select value={contractForm.status} onValueChange={v => setContractForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem><SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem><SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={contractForm.start_date} onChange={e => setContractForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Fim</Label><Input type="date" value={contractForm.end_date} onChange={e => setContractForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={contractForm.value} onChange={e => setContractForm(p => ({ ...p, value: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={contractForm.notes} onChange={e => setContractForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setContractDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={contractMutation.isPending}>Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ NOTE DIALOG ═══ */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Nota Interna</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); noteMutation.mutate(); }} className="space-y-4">
            <div><Label>Patrocinador *</Label><SponsorSelect value={noteForm.sponsor_id} onChange={v => setNoteForm(p => ({ ...p, sponsor_id: v }))} /></div>
            <div><Label>Conteúdo *</Label><Textarea required rows={4} value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNoteDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={noteMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ PERMISSIONS DIALOG ═══ */}
      <Dialog open={permDialog} onOpenChange={setPermDialog}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Permissões do Painel</DialogTitle></DialogHeader>
          {permContact && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Controle quais seções <strong>{permContact.contact_name || 'este contato'}</strong> pode acessar.
              </p>
              <div className="space-y-2">
                {Object.entries(PERM_LABELS).map(([key, label]) => {
                  const enabled = (permContact.permissions || {})[key] !== false;
                  return (
                    <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <span className="text-sm">{label}</span>
                      <Switch checked={enabled} onCheckedChange={checked => {
                        setPermContact({ ...permContact, permissions: { ...(permContact.permissions || {}), [key]: checked } });
                      }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPermDialog(false)}>Cancelar</Button>
                <Button onClick={() => { updatePermMutation.mutate({ id: permContact.id, permissions: permContact.permissions }); setPermDialog(false); }}>
                  Salvar Permissões
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSponsorsPage;
