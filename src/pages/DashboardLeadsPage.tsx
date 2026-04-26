import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, MessageCircle, AlertTriangle, Inbox, Trash2, TrendingUp, Clock, Send, History, Paperclip, Bell, BellOff, Timer, Search, Filter, FileDown, FileText, CalendarClock, ExternalLink, Settings2, MapPin, Tag, Compass, Radar, Sparkles } from 'lucide-react';
import { formatLeadOrigin, formatLeadLocation, hasLeadContext } from '@/lib/leadContext';
import { motion, AnimatePresence } from 'framer-motion';
import { whatsappLink } from '@/lib/whatsapp';
import { useAuth } from '@/hooks/useAuth';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { exportLeadsCsv, exportLeadsPdf } from '@/lib/exportLeads';
import RescheduleFollowupDialog from '@/components/leads/RescheduleFollowupDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useProviderLeads,
  useUpdateLeadStatus,
  useFollowupWindow,
  isOverdue,
  STATUS_META,
  FOLLOWUP_WINDOWS,
  type LeadStatus,
  type FollowupWindow,
  type LeadRow,
} from '@/hooks/useLeadFollowup';
import { useNewLeadAlerts } from '@/hooks/useNewLeadAlerts';
import { useLeadAlertPreference } from '@/hooks/useLeadAlertPreference';

interface LeadHistoryItem {
  id: string;
  lead_id: string;
  author_id: string;
  entry_type: 'message' | 'status_change' | string;
  old_status: string | null;
  new_status: string | null;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } } };

const STATUS_KEYS: LeadStatus[] = ['new', 'contacted', 'scheduled', 'completed', 'lost'];

const sortLeads = (items: LeadRow[]) => [...items].sort((a, b) => {
  // Vencidos primeiro
  const aOver = isOverdue(a) ? 1 : 0;
  const bOver = isOverdue(b) ? 1 : 0;
  if (aOver !== bOver) return bOver - aOver;
  const scoreDiff = (b.lead_score || 0) - (a.lead_score || 0);
  if (scoreDiff !== 0) return scoreDiff;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});

const DashboardLeadsPage = () => {
  const { user, provider, loading, profile } = useAuth();
  const { limits, canReceiveMoreLeads, remainingLeads, loading: limitsLoading } = useAccountLimits();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: rawLeads = [], isLoading: leadsLoading } = useProviderLeads(provider?.id);
  const updateStatus = useUpdateLeadStatus();
  const updateWindow = useFollowupWindow(provider?.id, provider?.lead_followup_hours);
  const [history, setHistory] = useState<Record<string, LeadHistoryItem[]>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | LeadStatus>(
    (searchParams.get('status') as any) || 'all'
  );
  const [historyDrafts, setHistoryDrafts] = useState<Record<string, string>>({});
  const { mode: alertMode, setMode: setAlertMode } = useLeadAlertPreference();
  const [, setTick] = useState(0);
  const leadsRef = useRef<LeadRow[]>([]);

  // Filtros avançados — inicializados a partir da URL
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [createdFrom, setCreatedFrom] = useState(searchParams.get('cf') || '');
  const [createdTo, setCreatedTo] = useState(searchParams.get('ct') || '');
  const [followupFrom, setFollowupFrom] = useState(searchParams.get('ff') || '');
  const [followupTo, setFollowupTo] = useState(searchParams.get('ft') || '');
  const [cityFilter, setCityFilter] = useState<string>(searchParams.get('city') || 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('cat') || 'all');
  const [ufFilter, setUfFilter] = useState<string>(searchParams.get('uf') || 'all');
  const [showAdvanced, setShowAdvanced] = useState(
    !!(searchParams.get('cf') || searchParams.get('ct') || searchParams.get('ff') || searchParams.get('ft'))
  );
  const [rescheduleLeadId, setRescheduleLeadId] = useState<string | null>(null);
  const [rescheduleDefault, setRescheduleDefault] = useState<string | null>(null);

  // Paginação client-side (incremental)
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Persistir filtros na URL (city/cat/uf são compartilháveis)
  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (search) params.q = search;
    if (createdFrom) params.cf = createdFrom;
    if (createdTo) params.ct = createdTo;
    if (followupFrom) params.ff = followupFrom;
    if (followupTo) params.ft = followupTo;
    if (cityFilter !== 'all') params.city = cityFilter;
    if (categoryFilter !== 'all') params.cat = categoryFilter;
    if (ufFilter !== 'all') params.uf = ufFilter;
    setSearchParams(params, { replace: true });
  }, [statusFilter, search, createdFrom, createdTo, followupFrom, followupTo, cityFilter, categoryFilter, ufFilter, setSearchParams]);

  // ─── Realtime: novos leads + alerta quando estiver fora do filtro atual ───
  const { outsideFilterCount, resetOutsideCount } = useNewLeadAlerts(provider?.id, {
    city: cityFilter,
    category: categoryFilter,
    uf: ufFilter,
  });

  // Re-render minute-by-minute para atualizar relativos e badge "vencido"
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Pipeline principal exclui leads do tipo 'click_only' (cliques diretos em
  // WhatsApp/Ligar) — eles aparecem em uma seção separada própria e não poluem
  // o funil de leads qualificados.
  const qualifiedRaw = useMemo(
    () => rawLeads.filter((l) => (l.lead_type ?? 'qualified') !== 'click_only'),
    [rawLeads],
  );
  const clickOnlyLeads = useMemo(
    () => rawLeads
      .filter((l) => l.lead_type === 'click_only')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rawLeads],
  );
  const clickOnlyCount = clickOnlyLeads.length;
  const clickWhatsappCount = useMemo(
    () => clickOnlyLeads.filter((l) => (l.lead_context as any)?.contact_kind === 'whatsapp').length,
    [clickOnlyLeads],
  );
  const clickPhoneCount = useMemo(
    () => clickOnlyLeads.filter((l) => (l.lead_context as any)?.contact_kind === 'phone').length,
    [clickOnlyLeads],
  );
  const leads = useMemo(() => sortLeads(qualifiedRaw), [qualifiedRaw]);

  const inRange = (iso: string | null | undefined, from: string, to: string) => {
    if (!iso) return !from && !to;
    const t = new Date(iso).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 86_400_000) return false;
    return true;
  };

  // Opções derivadas dos próprios leads (lê apenas — read-only) — popula os
  // selects de Cidade e Categoria com valores reais já recebidos.
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const loc = formatLeadLocation(l.lead_context);
      if (loc) set.add(loc);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [leads]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const cat = l.lead_context?.category?.trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [leads]);

  const ufOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const uf = String(l.lead_context?.state || '').trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(uf)) set.add(uf);
    });
    return Array.from(set).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let arr = leads;
    if (statusFilter === 'overdue') arr = arr.filter(isOverdue);
    else if (statusFilter !== 'all') arr = arr.filter((l) => l.status === statusFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter(l =>
        l.client_name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        (l.service_needed || '').toLowerCase().includes(q) ||
        (l.message || '').toLowerCase().includes(q)
      );
    }
    if (createdFrom || createdTo) arr = arr.filter(l => inRange(l.created_at, createdFrom, createdTo));
    if (followupFrom || followupTo) arr = arr.filter(l => inRange(l.next_followup_at, followupFrom, followupTo));
    if (cityFilter !== 'all') arr = arr.filter(l => formatLeadLocation(l.lead_context) === cityFilter);
    if (categoryFilter !== 'all') arr = arr.filter(l => (l.lead_context?.category || '').trim() === categoryFilter);
    if (ufFilter !== 'all') arr = arr.filter(l => String(l.lead_context?.state || '').trim().toUpperCase() === ufFilter);
    return arr;
  }, [leads, statusFilter, search, createdFrom, createdTo, followupFrom, followupTo, cityFilter, categoryFilter, ufFilter]);

  // Reset paginação quando filtros/lista mudarem
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, search, createdFrom, createdTo, followupFrom, followupTo, cityFilter, categoryFilter, ufFilter]);

  const visibleLeads = useMemo(() => filteredLeads.slice(0, visibleCount), [filteredLeads, visibleCount]);
  const hasMore = filteredLeads.length > visibleCount;

  const overdueCount = useMemo(() => leads.filter(isOverdue).length, [leads]);

  const clearFilters = () => {
    setSearch(''); setCreatedFrom(''); setCreatedTo(''); setFollowupFrom(''); setFollowupTo('');
    setStatusFilter('all'); setCityFilter('all'); setCategoryFilter('all'); setUfFilter('all');
  };

  const handleExportCsv = () => exportLeadsCsv({
    providerName: profile?.full_name, leads: filteredLeads, history,
    range: { from: createdFrom, to: createdTo },
  });
  const handleExportPdf = () => exportLeadsPdf({
    providerName: profile?.full_name, leads: filteredLeads, history,
    range: { from: createdFrom, to: createdTo },
  });

  const playAlert = useCallback(() => {
    if (alertMode !== 'sound' && alertMode !== 'both') return;
    const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
    audio.play().catch(() => {});
  }, [alertMode]);

  const fetchHistory = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    const { data } = await supabase
      .from('lead_history' as any)
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false });

    const grouped = ((data || []) as unknown as LeadHistoryItem[]).reduce<Record<string, LeadHistoryItem[]>>((acc, item) => {
      acc[item.lead_id] = [...(acc[item.lead_id] || []), item];
      return acc;
    }, {});
    setHistory(grouped);
  }, []);

  const handleDelete = async (leadId: string) => {
    if (!provider) return;
    const { error } = await supabase.from('leads').delete().eq('id', leadId).eq('provider_id', provider.id);
    if (error) {
      toast.error('Erro ao excluir lead');
      return;
    }
    toast.success('Lead excluído');
  };

  const handleStatusChange = (lead: LeadRow, status: LeadStatus) => {
    if (lead.status === status) return;
    updateStatus.mutate({ leadId: lead.id, status });
    playAlert();
  };

  const addHistoryMessage = async (leadId: string) => {
    const draft = historyDrafts[leadId]?.trim();
    if (!draft || !user) return;

    const { error } = await supabase.from('lead_history' as any).insert({
      lead_id: leadId,
      author_id: user.id,
      entry_type: 'message',
      message: draft,
    });

    if (error) {
      toast.error('Erro ao salvar mensagem');
      return;
    }
    setHistoryDrafts((prev) => ({ ...prev, [leadId]: '' }));
    toast.success('Mensagem adicionada ao histórico');
  };

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  // Carrega histórico inicial e mantém realtime
  useEffect(() => {
    if (!provider || leads.length === 0) return;
    void fetchHistory(leads.map((l) => l.id));
  }, [provider, leads, fetchHistory]);

  useEffect(() => {
    if (!provider) return;
    const historyChannel = supabase
      .channel(`dashboard-lead-history-${provider.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_history' }, (payload) => {
        const item = payload.new as LeadHistoryItem;
        setHistory((prev) => ({
          ...prev,
          [item.lead_id]: [item, ...(prev[item.lead_id] || []).filter((existing) => existing.id !== item.id)],
        }));
        if (item.entry_type === 'status_change') playAlert();
      })
      .subscribe();
    return () => { supabase.removeChannel(historyChannel); };
  }, [provider, playAlert]);

  if (loading || leadsLoading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  if (!limitsLoading && limits?.can_receive_leads === false) {
    return (
      <DashboardLayout>
        <motion.div className="flex flex-col items-center justify-center py-20 text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <AlertTriangle className="mb-4 h-12 w-12 text-destructive/60" />
          <h1 className="font-display text-xl font-bold text-foreground">Leads indisponíveis</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Sua categoria de conta atual não permite receber leads. Aumente seu engajamento para desbloquear este recurso.</p>
        </motion.div>
      </DashboardLayout>
    );
  }

  const currentWindow = (provider?.lead_followup_hours ?? 24) as FollowupWindow;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Solicitações de Serviço</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredLeads.length} de {leads.length} contato{leads.length !== 1 ? 's' : ''}
              {overdueCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueCount} pendente{overdueCount > 1 ? 's' : ''} de follow-up
                </span>
              )}
              {clickOnlyCount > 0 && (
                <span
                  className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  title="Cliques diretos em WhatsApp/Ligar — não entram no pipeline principal"
                >
                  {clickOnlyCount} clique{clickOnlyCount > 1 ? 's' : ''} direto{clickOnlyCount > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={alertMode} onValueChange={(v) => setAlertMode(v as any)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Como deseja receber alertas de novos leads">
                <div className="flex items-center gap-1.5">
                  {alertMode === 'off' ? <BellOff className="h-4 w-4 text-muted-foreground" /> : <Bell className="h-4 w-4 text-primary" />}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Som e toast</SelectItem>
                <SelectItem value="sound">Apenas som</SelectItem>
                <SelectItem value="toast">Apenas toast</SelectItem>
                <SelectItem value="off">Silencioso</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="overdue">Pendentes de follow-up</SelectItem>
                {STATUS_KEYS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* Alerta: novos leads chegaram fora do filtro atual */}
      {outsideFilterCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Bell className="h-4 w-4" />
            <span className="font-semibold">
              {outsideFilterCount} novo(s) lead(s) fora do filtro atual
            </span>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={resetOutsideCount}>
              Ignorar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { clearFilters(); resetOutsideCount(); }}>
              Limpar filtros
            </Button>
          </div>
        </motion.div>
      )}

      {/* Quick Filters (chips) — Mobile-first, sempre visíveis acima da toolbar */}
      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filtros rápidos de status">
        {([
          { key: 'all', label: 'Todos', count: leads.length },
          { key: 'new', label: 'Novos', count: leads.filter(l => l.status === 'new').length },
          { key: 'contacted', label: 'Em atendimento', count: leads.filter(l => ['contacted','scheduled'].includes(l.status)).length },
          { key: 'completed', label: 'Concluídos', count: leads.filter(l => l.status === 'completed').length },
          { key: 'lost', label: 'Perdidos', count: leads.filter(l => l.status === 'lost').length },
          ...(overdueCount > 0 ? [{ key: 'overdue', label: 'Vencidos', count: overdueCount }] : []),
        ] as Array<{ key: 'all'|'overdue'|LeadStatus; label: string; count: number }>).map((chip) => {
          const active = statusFilter === chip.key;
          const isOverdueChip = chip.key === 'overdue';
          return (
            <button
              key={chip.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(chip.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all min-h-[36px] ${
                active
                  ? isOverdueChip
                    ? 'bg-destructive text-destructive-foreground shadow-sm'
                    : 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {isOverdueChip && <AlertTriangle className="h-3 w-3" />}
              {chip.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                active ? 'bg-background/25' : 'bg-muted text-foreground'
              }`}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar sticky: busca + filtros + exportação */}
      <div className="sticky top-0 z-20 mt-3 -mx-4 rounded-none border-y border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:static sm:mx-0 sm:rounded-xl sm:border sm:px-3 sm:shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone, serviço ou mensagem" className="pl-9" />
          </div>
          {/* Filtro por Cidade — lê lead_context (read-only) */}
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por cidade">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} strokeWidth={1.5} />
                <SelectValue placeholder="Todas as cidades" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cityOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Filtro por Categoria — lê lead_context (read-only) */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por categoria">
              <div className="flex items-center gap-1.5">
                <Tag size={14} strokeWidth={1.5} />
                <SelectValue placeholder="Todas as categorias" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Filtro por UF (estado) — lê lead_context.state */}
          {ufOptions.length > 0 && (
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger className="w-full sm:w-28" aria-label="Filtrar por UF">
                <div className="flex items-center gap-1.5">
                  <Compass size={14} strokeWidth={1.5} />
                  <SelectValue placeholder="UF" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas UF</SelectItem>
                {ufOptions.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="button" variant={showAdvanced ? 'default' : 'outline'} size="sm" onClick={() => setShowAdvanced(v => !v)} className="gap-1">
            <Filter className="h-4 w-4" /> Mais filtros
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExportCsv} className="gap-1"><FileDown className="h-4 w-4" /> CSV</Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExportPdf} className="gap-1"><FileText className="h-4 w-4" /> PDF</Button>
          <Button asChild type="button" variant="outline" size="sm" className="gap-1">
            <Link to="/dashboard/notificacoes/preferencias"><Settings2 className="h-4 w-4" /> Notificações</Link>
          </Button>
        </div>
        {showAdvanced && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Criado de</label>
              <Input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Criado até</label>
              <Input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Próx. follow-up de</label>
              <Input type="date" value={followupFrom} onChange={e => setFollowupFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Próx. follow-up até</label>
              <Input type="date" value={followupTo} onChange={e => setFollowupTo(e.target.value)} className="h-9" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>
            </div>
          </div>
        )}
      </div>

      {/* Configuração de janela de follow-up */}
      <motion.div
        className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Timer className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Lembrete automático de follow-up</p>
            <p className="text-xs text-muted-foreground">Receba uma notificação quando um lead em aberto passar do tempo configurado.</p>
          </div>
        </div>
        <Select
          value={String(currentWindow)}
          onValueChange={(v) => updateWindow.mutate(Number(v) as FollowupWindow)}
          disabled={updateWindow.isPending}
        >
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FOLLOWUP_WINDOWS.map((h) => (
              <SelectItem key={h} value={String(h)}>A cada {h}h</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {!limitsLoading && limits && remainingLeads !== null && (
        <motion.div className={`mt-3 rounded-lg border p-3 text-sm ${!canReceiveMoreLeads ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-accent/20 bg-accent/5 text-foreground'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <div className="flex items-center gap-2">
            {!canReceiveMoreLeads && <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{!canReceiveMoreLeads ? `Limite de ${limits.max_leads} lead(s) atingido para sua categoria.` : `${remainingLeads} de ${limits.max_leads} lead(s) restante(s) na sua categoria.`}</span>
          </div>
        </motion.div>
      )}

      <motion.div className="mt-6 space-y-3" variants={containerVariants} initial="hidden" animate="show">
        <AnimatePresence mode="popLayout">
          {filteredLeads.length === 0 && (
            <motion.div key="empty" variants={itemVariants} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-10 text-center shadow-card">
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <span className="absolute inset-2 rounded-full bg-primary/10" />
                <Radar className="relative h-8 w-8 text-primary" />
              </div>
              <p className="font-display text-lg font-bold text-foreground">Aguardando novos contatos</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Quando um cliente enviar uma solicitação, ela aparecerá aqui em tempo real.
              </p>
              <Link
                to="/dashboard"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:scale-105"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Melhorar meu Score de Saúde
              </Link>
            </motion.div>
          )}
          {visibleLeads.map((lead) => {
            const meta = STATUS_META[lead.status];
            const overdue = isOverdue(lead);
            const leadHistory = history[lead.id] || [];
            return (
              <motion.div
                key={lead.id}
                layout
                variants={itemVariants}
                exit={{ opacity: 0, x: -80, transition: { duration: 0.3 } }}
                whileHover={{ y: -2 }}
                className={`rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover ${
                  overdue ? 'border-destructive/40 ring-1 ring-destructive/20' : 'border-border'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{lead.client_name}</p>
                      {lead.lead_score != null && <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" />{lead.lead_score}</Badge>}
                      <Badge variant="outline" className={`gap-1 border ${meta.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </Badge>
                      {overdue && (
                        <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Follow-up vencido
                        </Badge>
                      )}
                    </div>
                    {lead.service_needed && <p className="mt-1 text-xs font-medium text-accent">{lead.service_needed}</p>}

                    {/* Pílulas de contexto — leitura segura de lead_context.
                        Renderiza apenas quando há informação útil; leads antigos
                        sem contexto caem no fallback elegante (apenas mensagem). */}
                    {hasLeadContext(lead.lead_context) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {formatLeadLocation(lead.lead_context) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                            <MapPin size={12} strokeWidth={1.5} />
                            {formatLeadLocation(lead.lead_context)}
                          </span>
                        )}
                        {lead.lead_context?.category && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                            <Tag size={12} strokeWidth={1.5} />
                            {lead.lead_context.category}
                          </span>
                        )}
                        {lead.lead_context?.origin && lead.lead_context.origin !== 'unknown' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Compass size={12} strokeWidth={1.5} />
                            {formatLeadOrigin(lead.lead_context.origin)}
                          </span>
                        )}
                      </div>
                    )}

                    {lead.message && <p className="mt-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">{lead.message}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Recebido {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                      {lead.next_followup_at && ['new', 'contacted'].includes(lead.status) && (
                        <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-destructive' : ''}`}>
                          <Timer className="h-3 w-3" />
                          {overdue ? 'Vencido ' : 'Próximo lembrete '}
                          {formatDistanceToNow(new Date(lead.next_followup_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 space-y-2 sm:text-right">
                    <Select value={lead.status} onValueChange={(value) => handleStatusChange(lead, value as LeadStatus)}>
                      <SelectTrigger className="h-8 w-full sm:w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_KEYS.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Phone className="h-3 w-3" /> {lead.phone}</a>
                      <motion.a href={whatsappLink(lead.phone, `Olá ${lead.client_name}, aqui é ${profile?.full_name?.split(' ')[0] || 'o profissional'} do Preciso de um Profissional. Recebi seu pedido${lead.service_needed ? ` sobre "${lead.service_needed}"` : ''}. Como posso ajudar?`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 min-w-[44px] items-center justify-center gap-1 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600" title="Chamar no WhatsApp" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">Chamar</span></motion.a>
                      <button onClick={() => { setRescheduleLeadId(lead.id); setRescheduleDefault(lead.next_followup_at); }} className="inline-flex items-center justify-center rounded-full bg-primary/10 p-1.5 text-primary transition-colors hover:bg-primary/20" title="Reagendar follow-up"><CalendarClock className="h-4 w-4" /></button>
                      <Link to={`/dashboard/leads/${lead.id}`} className="inline-flex items-center justify-center rounded-full bg-muted p-1.5 text-foreground transition-colors hover:bg-muted/70" title="Ver detalhes"><ExternalLink className="h-4 w-4" /></Link>
                      <motion.button onClick={() => handleDelete(lead.id)} className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20" title="Excluir lead" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Trash2 className="h-4 w-4" /></motion.button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
                    <History className="h-4 w-4 text-primary" /> Timeline
                  </div>
                  <div className="space-y-3">
                    {leadHistory.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada ainda.</p>}
                    {leadHistory.map((item) => {
                      const isStatus = item.entry_type === 'status_change';
                      const oldM = isStatus && item.old_status && (STATUS_META as any)[item.old_status];
                      const newM = isStatus && item.new_status && (STATUS_META as any)[item.new_status];
                      return (
                        <div key={item.id} className="border-l-2 border-primary/30 pl-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">{isStatus ? 'Status' : 'Mensagem'}</Badge>
                            <span className="text-muted-foreground">{item.author_id === user?.id ? (profile?.full_name || 'Você') : 'Sistema'}</span>
                            <span className="text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          {isStatus && oldM && newM && <p className="mt-1 text-xs text-muted-foreground">{oldM.label} → <strong className="text-foreground">{newM.label}</strong></p>}
                          {item.message && <p className="mt-1 text-sm text-foreground">{item.message}</p>}
                          {item.attachment_url && <a className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={item.attachment_url} target="_blank" rel="noreferrer"><Paperclip className="h-3 w-3" />{item.attachment_name || 'Anexo'}</a>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input value={historyDrafts[lead.id] || ''} onChange={(event) => setHistoryDrafts((prev) => ({ ...prev, [lead.id]: event.target.value }))} placeholder="Adicionar nota ao histórico" className="h-9 text-xs" maxLength={500} />
                    <Button size="sm" variant="outline" onClick={() => addHistoryMessage(lead.id)} className="gap-1"><Send className="h-3 w-3" />Salvar</Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {hasMore && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Mostrando {visibleLeads.length} de {filteredLeads.length} leads filtrados
          </p>
          <Button
            variant="outline"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="min-w-[180px]"
          >
            Carregar mais ({Math.min(PAGE_SIZE, filteredLeads.length - visibleCount)})
          </Button>
        </div>
      )}

      {/* Seção separada: Cliques diretos (WhatsApp / Ligar) — não entram no pipeline */}
      {clickOnlyCount > 0 && (
        <ClickOnlySection
          leads={clickOnlyLeads}
          totalWhatsapp={clickWhatsappCount}
          totalPhone={clickPhoneCount}
        />
      )}

      <RescheduleFollowupDialog
        leadId={rescheduleLeadId}
        defaultDate={rescheduleDefault}
        open={!!rescheduleLeadId}
        onOpenChange={(open) => { if (!open) setRescheduleLeadId(null); }}
      />
    </DashboardLayout>
  );
};

// ---------------------------------------------------------------------------
// Sub-componente: Cliques diretos (click_only)
// Lista compacta, separada do pipeline, com filtro por tipo de clique e
// breakdown de WhatsApp x Ligar. Não polui o funil principal de leads.
// ---------------------------------------------------------------------------
type ClickFilter = 'all' | 'whatsapp' | 'phone';

const ClickOnlySection = ({
  leads,
  totalWhatsapp,
  totalPhone,
}: {
  leads: LeadRow[];
  totalWhatsapp: number;
  totalPhone: number;
}) => {
  const [filter, setFilter] = useState<ClickFilter>('all');
  const filtered = useMemo(() => {
    if (filter === 'all') return leads;
    return leads.filter((l) => (l.lead_context as any)?.contact_kind === filter);
  }, [leads, filter]);

  return (
    <section className="mt-8 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Compass className="h-4 w-4 text-muted-foreground" />
            Cliques diretos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visitantes que clicaram em WhatsApp ou Ligar no seu perfil público — não entram no pipeline principal.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className="h-7 px-2.5 text-xs"
          >
            Todos <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{leads.length}</Badge>
          </Button>
          <Button
            size="sm"
            variant={filter === 'whatsapp' ? 'default' : 'outline'}
            onClick={() => setFilter('whatsapp')}
            className="h-7 px-2.5 text-xs"
          >
            <MessageCircle className="h-3 w-3 mr-1" />
            WhatsApp <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{totalWhatsapp}</Badge>
          </Button>
          <Button
            size="sm"
            variant={filter === 'phone' ? 'default' : 'outline'}
            onClick={() => setFilter('phone')}
            className="h-7 px-2.5 text-xs"
          >
            <Phone className="h-3 w-3 mr-1" />
            Ligar <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">{totalPhone}</Badge>
          </Button>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border/60 rounded-lg border border-border/60 bg-background/60">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">Nenhum clique deste tipo.</p>
        )}
        {filtered.slice(0, 30).map((l) => {
          const ctx = (l.lead_context || {}) as any;
          const kind = ctx.contact_kind === 'phone' ? 'phone' : 'whatsapp';
          const loc = formatLeadLocation(l.lead_context);
          const cat = ctx.category || ctx.service || null;
          const when = formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR });
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-xs">
              <Badge variant="outline" className="gap-1">
                {kind === 'whatsapp' ? <MessageCircle className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                {kind === 'whatsapp' ? 'WhatsApp' : 'Ligar'}
              </Badge>
              {cat && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  {cat}
                </span>
              )}
              {loc && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {loc}
                </span>
              )}
              <span className="ml-auto text-muted-foreground">{when}</span>
            </div>
          );
        })}
      </div>
      {filtered.length > 30 && (
        <p className="mt-2 text-[11px] text-muted-foreground text-right">
          Mostrando os 30 cliques mais recentes de {filtered.length}.
        </p>
      )}
    </section>
  );
};

export default DashboardLeadsPage;
