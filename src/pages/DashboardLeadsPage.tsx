import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, MessageCircle, AlertTriangle, Inbox, Trash2, TrendingUp, Clock, Send, History, Paperclip, Bell, BellOff, Timer, Search, Filter, FileDown, FileText, CalendarClock, ExternalLink, Settings2 } from 'lucide-react';
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
  const { data: rawLeads = [], isLoading: leadsLoading } = useProviderLeads(provider?.id);
  const updateStatus = useUpdateLeadStatus();
  const updateWindow = useFollowupWindow(provider?.id, provider?.lead_followup_hours);
  const [history, setHistory] = useState<Record<string, LeadHistoryItem[]>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | LeadStatus>('all');
  const [historyDrafts, setHistoryDrafts] = useState<Record<string, string>>({});
  const [audibleAlerts, setAudibleAlerts] = useState(false);
  const [, setTick] = useState(0);
  const leadsRef = useRef<LeadRow[]>([]);

  // Filtros avançados
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [followupFrom, setFollowupFrom] = useState('');
  const [followupTo, setFollowupTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rescheduleLeadId, setRescheduleLeadId] = useState<string | null>(null);
  const [rescheduleDefault, setRescheduleDefault] = useState<string | null>(null);

  // Re-render minute-by-minute para atualizar relativos e badge "vencido"
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const leads = useMemo(() => sortLeads(rawLeads), [rawLeads]);

  const inRange = (iso: string | null | undefined, from: string, to: string) => {
    if (!iso) return !from && !to;
    const t = new Date(iso).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 86_400_000) return false;
    return true;
  };

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
    return arr;
  }, [leads, statusFilter, search, createdFrom, createdTo, followupFrom, followupTo]);

  const overdueCount = useMemo(() => leads.filter(isOverdue).length, [leads]);

  const clearFilters = () => {
    setSearch(''); setCreatedFrom(''); setCreatedTo(''); setFollowupFrom(''); setFollowupTo(''); setStatusFilter('all');
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
    if (!audibleAlerts) return;
    const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
    audio.play().catch(() => {});
  }, [audibleAlerts]);

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
            <h1 className="font-display text-2xl font-bold text-foreground">Leads Recebidos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredLeads.length} de {leads.length} lead(s)
              {overdueCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueCount} pendente{overdueCount > 1 ? 's' : ''} de follow-up
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              {audibleAlerts ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
              Alertas
              <Switch checked={audibleAlerts} onCheckedChange={setAudibleAlerts} />
            </label>
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

      {/* Toolbar: busca, filtros avançados e exportação */}
      <div className="mt-4 rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone, serviço ou mensagem" className="pl-9" />
          </div>
          <Button type="button" variant={showAdvanced ? 'default' : 'outline'} size="sm" onClick={() => setShowAdvanced(v => !v)} className="gap-1">
            <Filter className="h-4 w-4" /> Filtros
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
            <motion.div key="empty" variants={itemVariants} exit={{ opacity: 0, scale: 0.95 }} className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
              <Inbox className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
              <p className="font-semibold text-foreground">Nenhum lead encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">Quando clientes solicitarem orçamento, os leads aparecerão aqui.</p>
            </motion.div>
          )}
          {filteredLeads.map((lead) => {
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
                      <motion.a href={whatsappLink(lead.phone, `Olá ${lead.client_name}, recebi sua solicitação${lead.service_needed ? ` sobre "${lead.service_needed}"` : ''}. Como posso ajudar?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full bg-accent p-1.5 text-accent-foreground transition-colors hover:bg-accent/90" title="Responder pelo WhatsApp" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><MessageCircle className="h-4 w-4" /></motion.a>
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
    </DashboardLayout>
  );
};

export default DashboardLeadsPage;
