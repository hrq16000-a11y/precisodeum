import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, UserCheck, Briefcase, Building2, TrendingUp, ArrowRight,
  Filter, Download, Send, Search, ChevronDown, BarChart3, Target,
  UserPlus, Clock, Eye, Mail, Tag, X, Plus, Activity, FileText
} from 'lucide-react';
import { exportCrmPdf } from '@/lib/exportCrmPdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PaginationControls from '@/components/PaginationControls';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, subMonths, startOfDay, startOfMonth, parseISO, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 15;

const FUNNEL_STAGES = [
  { key: 'registered', label: 'Cadastrado', color: 'bg-blue-500' },
  { key: 'profile_complete', label: 'Perfil Completo', color: 'bg-cyan-500' },
  { key: 'active_provider', label: 'Profissional Ativo', color: 'bg-emerald-500' },
  { key: 'premium', label: 'Premium', color: 'bg-amber-500' },
];

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const TAG_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

const AdminUsersCrmPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [userTags, setUserTags] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Tag management
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagTargetIds, setTagTargetIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const fetchData = () => {
    Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('providers').select('id,user_id,plan,status,city,state,created_at').is('deleted_at', null),
      supabase.from('services').select('id,provider_id,created_at').is('deleted_at', null),
      supabase.from('leads').select('id,provider_id,created_at'),
      supabase.from('user_tags').select('*'),
    ]).then(([pRes, prRes, sRes, lRes, tRes]) => {
      setProfiles(pRes.data || []);
      setProviders(prRes.data || []);
      setServices(sRes.data || []);
      setLeads(lRes.data || []);
      setUserTags(tRes.data || []);
    });
  };

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  // Derived data
  const providerByUser = useMemo(() => {
    const map: Record<string, any> = {};
    providers.forEach(p => { map[p.user_id] = p; });
    return map;
  }, [providers]);

  const servicesByProvider = useMemo(() => {
    const map: Record<string, number> = {};
    services.forEach(s => { map[s.provider_id] = (map[s.provider_id] || 0) + 1; });
    return map;
  }, [services]);

  const leadsByProvider = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => { map[l.provider_id] = (map[l.provider_id] || 0) + 1; });
    return map;
  }, [leads]);

  // Tags by user
  const tagsByUser = useMemo(() => {
    const map: Record<string, any[]> = {};
    userTags.forEach(t => {
      if (!map[t.user_id]) map[t.user_id] = [];
      map[t.user_id].push(t);
    });
    return map;
  }, [userTags]);

  // All unique tag names
  const allTagNames = useMemo(() => {
    const set = new Set<string>();
    userTags.forEach(t => set.add(t.tag_name));
    return Array.from(set).sort();
  }, [userTags]);

  // Cities list
  const cities = useMemo(() => {
    const set = new Set<string>();
    providers.forEach(p => { if (p.city) set.add(p.city); });
    return Array.from(set).sort();
  }, [providers]);

  // Funnel data
  const funnelData = useMemo(() => {
    const total = profiles.length;
    const withProfile = profiles.filter(p => p.full_name && p.full_name.trim().length > 2).length;
    const activeProviders = providers.filter(p => p.status === 'approved').length;
    const premium = providers.filter(p => p.plan === 'premium').length;
    return [
      { ...FUNNEL_STAGES[0], count: total, pct: 100 },
      { ...FUNNEL_STAGES[1], count: withProfile, pct: total ? Math.round((withProfile / total) * 100) : 0 },
      { ...FUNNEL_STAGES[2], count: activeProviders, pct: total ? Math.round((activeProviders / total) * 100) : 0 },
      { ...FUNNEL_STAGES[3], count: premium, pct: total ? Math.round((premium / total) * 100) : 0 },
    ];
  }, [profiles, providers]);

  // Growth chart (last 30 days)
  const growthData = useMemo(() => {
    const days: { date: string; users: number; providers: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayStr = format(day, 'yyyy-MM-dd');
      const label = format(day, 'dd/MM');
      const usersCount = profiles.filter(p => format(parseISO(p.created_at), 'yyyy-MM-dd') === dayStr).length;
      const provsCount = providers.filter(p => format(parseISO(p.created_at), 'yyyy-MM-dd') === dayStr).length;
      days.push({ date: label, users: usersCount, providers: provsCount });
    }
    return days;
  }, [profiles, providers]);

  // Type distribution
  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = { client: 0, provider: 0, rh: 0, other: 0 };
    profiles.forEach(p => {
      const t = p.profile_type || 'other';
      counts[t] = (counts[t] || 0) + 1;
    });
    return [
      { name: 'Clientes', value: counts.client },
      { name: 'Profissionais', value: counts.provider },
      { name: 'Agências/RH', value: counts.rh },
    ].filter(d => d.value > 0);
  }, [profiles]);

  // Retention data (last 12 months)
  const retentionData = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
    return months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const label = format(month, 'MMM/yy', { locale: ptBR });

      // Users created up to end of this month
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
      const totalByMonth = profiles.filter(p => parseISO(p.created_at) <= endOfMonth).length;
      const activeByMonth = profiles.filter(p => parseISO(p.created_at) <= endOfMonth && p.status !== 'inactive').length;
      const inactiveByMonth = totalByMonth - activeByMonth;

      // New users in this month
      const newInMonth = profiles.filter(p => format(parseISO(p.created_at), 'yyyy-MM') === monthStr).length;

      return {
        month: label,
        total: totalByMonth,
        ativos: activeByMonth,
        inativos: inactiveByMonth,
        novos: newInMonth,
        retentionRate: totalByMonth > 0 ? Math.round((activeByMonth / totalByMonth) * 100) : 0,
      };
    });
  }, [profiles]);

  // Filtered users
  const filtered = useMemo(() => {
    let list = profiles;
    if (filterType !== 'all') list = list.filter(p => (p.profile_type || p.role) === filterType);
    if (filterStatus !== 'all') list = list.filter(p => (p.status || 'active') === filterStatus);
    if (filterPeriod !== 'all') {
      const days = parseInt(filterPeriod);
      const since = subDays(new Date(), days).toISOString();
      list = list.filter(p => p.created_at >= since);
    }
    if (filterCity !== 'all') {
      const cityProviderUserIds = new Set(providers.filter(p => p.city === filterCity).map(p => p.user_id));
      list = list.filter(p => cityProviderUserIds.has(p.id));
    }
    if (filterTag !== 'all') {
      const tagUserIds = new Set(userTags.filter(t => t.tag_name === filterTag).map(t => t.user_id));
      list = list.filter(p => tagUserIds.has(p.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.user_ref || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, search, filterType, filterStatus, filterPeriod, filterCity, filterTag, providers, userTags]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const ids = paginated.map(p => p.id);
    const all = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => all ? next.delete(id) : next.add(id));
      return next;
    });
  };

  // Tag operations
  const handleAddTag = async () => {
    if (!newTagName.trim()) { toast.error('Digite o nome da tag'); return; }
    const ids = tagTargetIds.length > 0 ? tagTargetIds : Array.from(selectedIds);
    if (ids.length === 0) { toast.error('Selecione pelo menos um usuário'); return; }

    const rows = ids.map(uid => ({ user_id: uid, tag_name: newTagName.trim(), color: newTagColor }));
    const { error } = await supabase.from('user_tags').upsert(rows, { onConflict: 'user_id,tag_name' });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success(`Tag "${newTagName}" aplicada a ${ids.length} usuário(s)`);
    setShowTagDialog(false);
    setNewTagName('');
    setTagTargetIds([]);
    fetchData();
  };

  const handleRemoveTag = async (tagId: string) => {
    await supabase.from('user_tags').delete().eq('id', tagId);
    setUserTags(prev => prev.filter(t => t.id !== tagId));
    toast.success('Tag removida');
  };

  // Send notification
  const handleSendNotification = async () => {
    if (!notifyTitle.trim() || !notifyMessage.trim()) { toast.error('Preencha título e mensagem'); return; }
    setSending(true);
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : filtered.map(p => p.id);
    const rows = ids.map(uid => ({ user_id: uid, title: notifyTitle, message: notifyMessage, type: 'crm' }));
    const batchSize = 100;
    let sent = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from('notifications').insert(batch);
      if (error) { toast.error('Erro ao enviar: ' + error.message); break; }
      sent += batch.length;
    }
    toast.success(`${sent} notificação(ões) enviada(s)`);
    setSending(false);
    setShowNotifyDialog(false);
    setNotifyTitle('');
    setNotifyMessage('');
  };

  // CSV helper
  const downloadCsv = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return rows.length;
  };

  // Export Users CSV
  const exportUsersCsv = () => {
    const data = (selectedIds.size > 0 ? filtered.filter(p => selectedIds.has(p.id)) : filtered);
    const headers = ['Nome', 'Email', 'Telefone', 'WhatsApp', 'Tipo', 'Status', 'Tags', 'Cidade', 'Plano', 'Serviços', 'Leads', 'Ref', 'Cadastro'];
    const rows = data.map(p => {
      const prov = providerByUser[p.id];
      return [
        p.full_name, p.email, p.phone, p.whatsapp,
        getTypeLabel(p.profile_type), p.status,
        (tagsByUser[p.id] || []).map((t: any) => t.tag_name).join('; '),
        prov?.city || '', prov?.plan || 'free',
        prov ? (servicesByProvider[prov.id] || 0) : 0,
        prov ? (leadsByProvider[prov.id] || 0) : 0,
        p.user_ref,
        format(parseISO(p.created_at), 'dd/MM/yyyy HH:mm')
      ];
    });
    const count = downloadCsv(`crm-usuarios-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
    toast.success(`${count} usuários exportados`);
  };

  // Export Leads CSV
  const exportLeadsCsv = () => {
    const headers = ['Prestador', 'Cidade', 'Cliente', 'Telefone', 'Serviço', 'Status', 'Data'];
    const provMap: Record<string, any> = {};
    providers.forEach(p => { provMap[p.id] = p; });
    const profileMap: Record<string, any> = {};
    profiles.forEach(p => { profileMap[p.id] = p; });

    const rows = leads.map(l => {
      const prov = provMap[l.provider_id];
      const provProfile = prov ? profileMap[prov.user_id] : null;
      return [
        provProfile?.full_name || '—',
        prov?.city || '',
        l.client_name, l.phone, l.service_needed || '',
        l.status,
        format(parseISO(l.created_at), 'dd/MM/yyyy HH:mm')
      ];
    });
    const count = downloadCsv(`crm-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
    toast.success(`${count} leads exportados`);
  };

  // Export Metrics CSV (growth, retention, funnel)
  const exportMetricsCsv = () => {
    const lines: string[][] = [];

    // Funnel
    lines.push(['=== FUNIL DE CONVERSÃO ===', '', '']);
    lines.push(['Etapa', 'Total', 'Porcentagem']);
    funnelData.forEach(s => lines.push([s.label, String(s.count), s.pct + '%']));
    lines.push(['', '', '']);

    // Growth
    lines.push(['=== CRESCIMENTO (30 DIAS) ===', '', '']);
    lines.push(['Data', 'Novos Usuários', 'Novos Profissionais']);
    growthData.forEach(d => lines.push([d.date, String(d.users), String(d.providers)]));
    lines.push(['', '', '']);

    // Retention
    lines.push(['=== RETENÇÃO (12 MESES) ===', '', '', '', '']);
    lines.push(['Mês', 'Total', 'Ativos', 'Inativos', 'Novos', 'Taxa Retenção']);
    retentionData.forEach(r => lines.push([r.month, String(r.total), String(r.ativos), String(r.inativos), String(r.novos), r.retentionRate + '%']));
    lines.push(['', '', '']);

    // Distribution
    lines.push(['=== DISTRIBUIÇÃO POR TIPO ===', '']);
    lines.push(['Tipo', 'Total']);
    typeDistribution.forEach(d => lines.push([d.name, String(d.value)]));

    const maxCols = Math.max(...lines.map(l => l.length));
    const padded = lines.map(l => [...l, ...Array(maxCols - l.length).fill('')]);

    const csv = padded.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-metricas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Métricas exportadas (funil, crescimento, retenção)');
  };

  const getTypeLabel = (t: string) => {
    if (t === 'provider') return 'Profissional';
    if (t === 'rh') return 'Agência/RH';
    if (t === 'client') return 'Cliente';
    return t || '—';
  };

  const getStatusBadge = (s: string) => {
    if (s === 'active') return <Badge className="bg-emerald-100 text-emerald-700 border-0">Ativo</Badge>;
    if (s === 'inactive') return <Badge className="bg-amber-100 text-amber-700 border-0">Inativo</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  if (loading) return <AdminLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div></AdminLayout>;

  const stats = {
    total: profiles.length,
    new7d: profiles.filter(p => p.created_at >= subDays(new Date(), 7).toISOString()).length,
    new30d: profiles.filter(p => p.created_at >= subDays(new Date(), 30).toISOString()).length,
    activeProviders: providers.filter(p => p.status === 'approved').length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" /> CRM de Usuários
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Funil, segmentação, métricas, tags e retenção</p>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Exportar <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <button onClick={exportUsersCsv} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent/10 text-foreground">
                  <Users className="h-4 w-4" /> Usuários (CSV)
                </button>
                <button onClick={exportLeadsCsv} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent/10 text-foreground">
                  <Briefcase className="h-4 w-4" /> Leads (CSV)
                </button>
                <button onClick={exportMetricsCsv} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent/10 text-foreground">
                  <BarChart3 className="h-4 w-4" /> Métricas (CSV)
                </button>
                <div className="border-t border-border my-1" />
                <button onClick={() => {
                  exportCrmPdf({ stats, funnelData, growthData, retentionData, typeDistribution, totalLeads: leads.length });
                  toast.success('PDF gerado — use Ctrl+P para salvar');
                }} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent/10 text-foreground">
                  <FileText className="h-4 w-4" /> Relatório (PDF)
                </button>
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={() => setShowNotifyDialog(true)}>
              <Send className="h-4 w-4 mr-1" /> Enviar Notificação
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
                <span className="text-xs font-medium text-muted-foreground">{stats.total}</span>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total de Usuários</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-emerald-500/10 p-2"><UserPlus className="h-5 w-5 text-emerald-600" /></div>
                <span className="text-xs font-medium text-emerald-600">+{stats.new7d} esta semana</span>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-foreground">{stats.new30d}</p>
              <p className="text-xs text-muted-foreground">Novos (30 dias)</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-blue-500/10 p-2"><Briefcase className="h-5 w-5 text-blue-600" /></div>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-foreground">{stats.activeProviders}</p>
              <p className="text-xs text-muted-foreground">Profissionais Ativos</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-amber-500/10 p-2"><TrendingUp className="h-5 w-5 text-amber-600" /></div>
                <span className="text-xs font-medium text-amber-600">{stats.total > 0 ? Math.round((stats.activeProviders / stats.total) * 100) : 0}%</span>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-foreground">{providers.filter(p => p.plan === 'premium').length}</p>
              <p className="text-xs text-muted-foreground">Contas Premium</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
            <TabsTrigger value="funnel"><Target className="h-4 w-4 mr-1" /> Funil</TabsTrigger>
            <TabsTrigger value="retention"><Activity className="h-4 w-4 mr-1" /> Retenção</TabsTrigger>
            <TabsTrigger value="segment"><Filter className="h-4 w-4 mr-1" /> Segmentar</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Crescimento (30 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={growthData}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProvs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <Tooltip />
                      <Area type="monotone" dataKey="users" name="Usuários" stroke="hsl(var(--primary))" fill="url(#colorUsers)" strokeWidth={2} />
                      <Area type="monotone" dataKey="providers" name="Profissionais" stroke="hsl(var(--chart-2))" fill="url(#colorProvs)" strokeWidth={2} />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={typeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {typeDistribution.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top cities */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Cidades (Profissionais)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={(() => {
                    const cityCount: Record<string, number> = {};
                    providers.forEach(p => { if (p.city) cityCount[p.city] = (cityCount[p.city] || 0) + 1; });
                    return Object.entries(cityCount)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10)
                      .map(([city, count]) => ({ city, count }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Profissionais" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funil de Conversão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {funnelData.map((stage, idx) => (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div className="w-32 text-sm font-medium text-foreground shrink-0">{stage.label}</div>
                    <div className="flex-1 relative">
                      <div className="h-10 rounded-lg bg-muted overflow-hidden">
                        <div
                          className={`h-full ${stage.color} rounded-lg transition-all duration-700 flex items-center px-3`}
                          style={{ width: `${Math.max(stage.pct, 5)}%` }}
                        >
                          <span className="text-xs font-bold text-white whitespace-nowrap">{stage.count} ({stage.pct}%)</span>
                        </div>
                      </div>
                    </div>
                    {idx < funnelData.length - 1 && (
                      <div className="shrink-0 text-muted-foreground">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Conversion rates */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {[
                { label: 'Cadastro → Perfil', from: funnelData[0].count, to: funnelData[1].count },
                { label: 'Perfil → Profissional', from: funnelData[1].count, to: funnelData[2].count },
                { label: 'Profissional → Premium', from: funnelData[2].count, to: funnelData[3].count },
              ].map(conv => (
                <Card key={conv.label}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{conv.label}</p>
                    <p className="font-display text-3xl font-bold text-primary">
                      {conv.from > 0 ? Math.round((conv.to / conv.from) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">{conv.to} de {conv.from}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Retention Tab */}
          <TabsContent value="retention" className="space-y-4">
            {/* Retention KPIs */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Taxa de Retenção Atual</p>
                  <p className="font-display text-3xl font-bold text-emerald-600">
                    {retentionData.length > 0 ? retentionData[retentionData.length - 1].retentionRate : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Ativos / Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Usuários Ativos</p>
                  <p className="font-display text-3xl font-bold text-primary">
                    {profiles.filter(p => p.status !== 'inactive').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Com status ativo</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Usuários Inativos</p>
                  <p className="font-display text-3xl font-bold text-destructive">
                    {profiles.filter(p => p.status === 'inactive').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Bloqueados ou desativados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Churn Mensal</p>
                  <p className="font-display text-3xl font-bold text-amber-600">
                    {profiles.length > 0 ? Math.round((profiles.filter(p => p.status === 'inactive').length / profiles.length) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Inativos / Total</p>
                </CardContent>
              </Card>
            </div>

            {/* Retention chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ativos vs Inativos (12 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={retentionData}>
                    <defs>
                      <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorInativos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="ativos" name="Ativos" stroke="#10b981" fill="url(#colorAtivos)" strokeWidth={2} />
                    <Area type="monotone" dataKey="inativos" name="Inativos" stroke="#ef4444" fill="url(#colorInativos)" strokeWidth={2} />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Retention rate trend */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Retenção (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={retentionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Line type="monotone" dataKey="retentionRate" name="Retenção" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Novos Cadastros por Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={retentionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="novos" name="Novos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Segment Tab */}
          <TabsContent value="segment" className="space-y-4">
            {/* Filters bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs">Buscar</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Nome, email, ref..." className="pl-8" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                  <div className="w-36">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="provider">Profissional</SelectItem>
                        <SelectItem value="rh">Agência/RH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Label className="text-xs">Status</Label>
                    <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Label className="text-xs">Período</Label>
                    <Select value={filterPeriod} onValueChange={v => { setFilterPeriod(v); setPage(1); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todo período</SelectItem>
                        <SelectItem value="7">Últimos 7 dias</SelectItem>
                        <SelectItem value="30">Últimos 30 dias</SelectItem>
                        <SelectItem value="90">Últimos 90 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label className="text-xs">Cidade</Label>
                    <Select value={filterCity} onValueChange={v => { setFilterCity(v); setPage(1); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label className="text-xs">Tag</Label>
                    <Select value={filterTag} onValueChange={v => { setFilterTag(v); setPage(1); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {allTagNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-sm text-muted-foreground">
                    {filtered.length} resultado(s) {selectedIds.size > 0 && `• ${selectedIds.size} selecionado(s)`}
                  </span>
                  <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                      <Button variant="outline" size="sm" onClick={() => { setTagTargetIds(Array.from(selectedIds)); setShowTagDialog(true); }}>
                        <Tag className="h-3 w-3 mr-1" /> Aplicar Tag ({selectedIds.size})
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={exportUsersCsv}>
                      <Download className="h-3 w-3 mr-1" /> CSV
                    </Button>
                    <Button size="sm" onClick={() => setShowNotifyDialog(true)}>
                      <Send className="h-3 w-3 mr-1" /> Notificar {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filtered.length})`}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Users table */}
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-3 w-10">
                        <Checkbox
                          checked={paginated.length > 0 && paginated.every(p => selectedIds.has(p.id))}
                          onCheckedChange={selectAllOnPage}
                        />
                      </th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Usuário</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Status</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Tags</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Cidade</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Serviços</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Leads</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(p => {
                      const prov = providerByUser[p.id];
                      const svcCount = prov ? (servicesByProvider[prov.id] || 0) : 0;
                      const leadCount = prov ? (leadsByProvider[prov.id] || 0) : 0;
                      const tags = tagsByUser[p.id] || [];
                      return (
                        <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelection(p.id)} />
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-foreground">{p.full_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{p.email}</div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <Badge variant="outline" className="text-xs">{getTypeLabel(p.profile_type)}</Badge>
                          </td>
                          <td className="p-3 hidden md:table-cell">{getStatusBadge(p.status || 'active')}</td>
                          <td className="p-3 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1 items-center">
                              {tags.map((t: any) => (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                  style={{ backgroundColor: t.color }}
                                >
                                  {t.tag_name}
                                  <button onClick={() => handleRemoveTag(t.id)} className="hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
                                </span>
                              ))}
                              <button
                                onClick={() => { setTagTargetIds([p.id]); setShowTagDialog(true); }}
                                className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 hidden lg:table-cell text-muted-foreground">{prov?.city || '—'}</td>
                          <td className="p-3 hidden xl:table-cell text-muted-foreground">{svcCount}</td>
                          <td className="p-3 hidden xl:table-cell text-muted-foreground">{leadCount}</td>
                          <td className="p-3 text-xs text-muted-foreground">{format(parseISO(p.created_at), 'dd/MM/yy')}</td>
                        </tr>
                      );
                    })}
                    {paginated.length === 0 && (
                      <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Aplicar Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aplicar a {tagTargetIds.length} usuário(s).
            </p>
            <div>
              <Label>Nome da Tag</Label>
              <Input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="Ex: VIP, Leads Quentes, Inativo..."
                list="existing-tags"
              />
              <datalist id="existing-tags">
                {allTagNames.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddTag}>Aplicar Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Notificação em Massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Será enviada para {selectedIds.size > 0 ? `${selectedIds.size} usuário(s) selecionado(s)` : `${filtered.length} usuário(s) do filtro atual`}.
            </p>
            <div>
              <Label>Título</Label>
              <Input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="Título da notificação" />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} placeholder="Escreva a mensagem..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendNotification} disabled={sending}>
              {sending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsersCrmPage;
