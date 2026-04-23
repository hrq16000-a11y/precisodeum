import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, MessageCircle, AlertTriangle, Inbox, Trash2, TrendingUp, Clock, CheckCircle2, Send, History, Paperclip, Bell, BellOff } from 'lucide-react';
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

type LeadStatus = 'new' | 'in_progress' | 'completed';

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

const statusMeta: Record<LeadStatus, { label: string; icon: typeof Clock; className: string }> = {
  new: { label: 'Novo', icon: AlertTriangle, className: 'bg-accent/10 text-accent border-accent/20' },
  in_progress: { label: 'Em andamento', icon: Clock, className: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'Concluído', icon: CheckCircle2, className: 'bg-muted text-muted-foreground border-border' },
};

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } } };

const normalizeStatus = (status?: string): LeadStatus => {
  if (status === 'in_progress' || status === 'completed') return status;
  return 'new';
};

const sortLeads = (items: any[]) => [...items].sort((a, b) => {
  const scoreDiff = (Number(b.lead_score) || 0) - (Number(a.lead_score) || 0);
  if (scoreDiff !== 0) return scoreDiff;
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
});

const DashboardLeadsPage = () => {
  const { user, provider, loading, profile } = useAuth();
  const { limits, canReceiveMoreLeads, remainingLeads, loading: limitsLoading } = useAccountLimits();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, LeadHistoryItem[]>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [historyDrafts, setHistoryDrafts] = useState<Record<string, string>>({});
  const [audibleAlerts, setAudibleAlerts] = useState(false);

  const filteredLeads = useMemo(() => (
    statusFilter === 'all' ? leads : leads.filter((lead) => normalizeStatus(lead.status) === statusFilter)
  ), [leads, statusFilter]);

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

    const grouped = ((data || []) as LeadHistoryItem[]).reduce<Record<string, LeadHistoryItem[]>>((acc, item) => {
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
    setLeads(prev => prev.filter(l => l.id !== leadId));
    toast.success('Lead excluído');
  };

  const handleStatusChange = async (lead: any, status: LeadStatus) => {
    if (!provider || normalizeStatus(lead.status) === status) return;
    const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id).eq('provider_id', provider.id);
    if (error) {
      toast.error('Erro ao atualizar status');
      return;
    }
    setLeads(prev => prev.map(item => item.id === lead.id ? { ...item, status } : item));
    toast.success(`Status atualizado para ${statusMeta[status].label}`);
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
    setHistoryDrafts(prev => ({ ...prev, [leadId]: '' }));
    toast.success('Mensagem adicionada ao histórico');
  };

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!provider) return;
    supabase.from('leads')
      .select('*')
      .eq('provider_id', provider.id)
      .order('lead_score', { ascending: false })
      .then(({ data }) => {
        const nextLeads = sortLeads(data || []);
        setLeads(nextLeads);
        void fetchHistory(nextLeads.map(lead => lead.id));
      });

    const leadChannel = supabase
      .channel(`dashboard-leads-${provider.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `provider_id=eq.${provider.id}` }, (payload) => {
        setLeads(prev => sortLeads([payload.new, ...prev.filter(lead => lead.id !== (payload.new as any).id)]));
        toast.info('Novo lead recebido');
        playAlert();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `provider_id=eq.${provider.id}` }, (payload) => {
        const before = leads.find(lead => lead.id === (payload.new as any).id);
        setLeads(prev => sortLeads(prev.map(lead => lead.id === (payload.new as any).id ? payload.new : lead)));
        if (before && before.status !== (payload.new as any).status) {
          toast.info(`Status de ${((payload.new as any).client_name || 'um lead')} atualizado`);
          playAlert();
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads', filter: `provider_id=eq.${provider.id}` }, (payload) => {
        setLeads(prev => prev.filter(lead => lead.id !== (payload.old as any).id));
      })
      .subscribe();

    const historyChannel = supabase
      .channel(`dashboard-lead-history-${provider.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_history' }, (payload) => {
        const item = payload.new as LeadHistoryItem;
        setHistory(prev => ({
          ...prev,
          [item.lead_id]: [item, ...(prev[item.lead_id] || []).filter(existing => existing.id !== item.id)],
        }));
        if (item.entry_type === 'status_change') toast.info('Histórico de status atualizado');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [provider, fetchHistory, playAlert, leads]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

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

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Leads Recebidos</h1>
            <p className="mt-1 text-sm text-muted-foreground">{filteredLeads.length} de {leads.length} lead(s) exibido(s)</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              {audibleAlerts ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
              Alertas
              <Switch checked={audibleAlerts} onCheckedChange={setAudibleAlerts} />
            </label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | LeadStatus)}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {!limitsLoading && limits && remainingLeads !== null && (
        <motion.div className={`mt-3 rounded-lg border p-3 text-sm ${!canReceiveMoreLeads ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-accent/20 bg-accent/5 text-foreground'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
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
            const status = normalizeStatus(lead.status);
            const StatusIcon = statusMeta[status].icon;
            const leadHistory = history[lead.id] || [];
            return (
              <motion.div key={lead.id} layout variants={itemVariants} exit={{ opacity: 0, x: -80, transition: { duration: 0.3 } }} whileHover={{ y: -2, scale: 1.005 }} className="rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{lead.client_name}</p>
                      {lead.lead_score != null && <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" />{lead.lead_score}</Badge>}
                      <Badge variant="outline" className={`gap-1 ${statusMeta[status].className}`}><StatusIcon className="h-3 w-3" />{statusMeta[status].label}</Badge>
                    </div>
                    {lead.service_needed && <p className="text-xs font-medium text-accent">{lead.service_needed}</p>}
                    {lead.message && <p className="mt-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">{lead.message}</p>}
                  </div>
                  <div className="shrink-0 space-y-2 sm:text-right">
                    <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
                    <Select value={status} onValueChange={(value) => handleStatusChange(lead, value as LeadStatus)}>
                      <SelectTrigger className="h-8 w-full sm:w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Novo</SelectItem>
                        <SelectItem value="in_progress">Em andamento</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Phone className="h-3 w-3" /> {lead.phone}</a>
                      <motion.a href={whatsappLink(lead.phone, `Olá ${lead.client_name}, recebi sua solicitação${lead.service_needed ? ` sobre &quot;${lead.service_needed}&quot;` : ''}. Como posso ajudar?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full bg-accent p-1.5 text-accent-foreground transition-colors hover:bg-accent/90" title="Responder pelo WhatsApp" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><MessageCircle className="h-4 w-4" /></motion.a>
                      <motion.button onClick={() => handleDelete(lead.id)} className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20" title="Excluir lead" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Trash2 className="h-4 w-4" /></motion.button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
                    <History className="h-4 w-4 text-primary" /> Timeline e auditoria
                  </div>
                  <div className="space-y-3">
                    {leadHistory.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada ainda.</p>}
                    {leadHistory.map(item => {
                      const isStatus = item.entry_type === 'status_change';
                      return (
                        <div key={item.id} className="border-l-2 border-primary/30 pl-3">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">{isStatus ? 'Status' : 'Mensagem'}</Badge>
                            <span className="text-muted-foreground">{item.author_id === user?.id ? (profile?.name || 'Você') : 'Sistema/Equipe'}</span>
                            <span className="text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          {isStatus && <p className="mt-1 text-xs text-muted-foreground">{statusMeta[normalizeStatus(item.old_status || undefined)].label} → {statusMeta[normalizeStatus(item.new_status || undefined)].label}</p>}
                          {item.message && <p className="mt-1 text-sm text-foreground">{item.message}</p>}
                          {item.attachment_url && <a className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={item.attachment_url} target="_blank" rel="noreferrer"><Paperclip className="h-3 w-3" />{item.attachment_name || 'Anexo'}</a>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input value={historyDrafts[lead.id] || ''} onChange={(event) => setHistoryDrafts(prev => ({ ...prev, [lead.id]: event.target.value }))} placeholder="Adicionar mensagem ao histórico" className="h-9 text-xs" maxLength={500} />
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