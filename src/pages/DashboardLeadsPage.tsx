import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, MessageCircle, AlertTriangle, Inbox, Trash2, TrendingUp, Clock, CheckCircle2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { whatsappLink } from '@/lib/whatsapp';
import { useAuth } from '@/hooks/useAuth';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type LeadStatus = 'new' | 'in_progress' | 'completed';

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

const DashboardLeadsPage = () => {
  const { user, provider, loading } = useAuth();
  const { limits, canReceiveMoreLeads, remainingLeads, loading: limitsLoading } = useAccountLimits();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [historyDrafts, setHistoryDrafts] = useState<Record<string, string>>({});

  const filteredLeads = useMemo(() => (
    statusFilter === 'all' ? leads : leads.filter((lead) => normalizeStatus(lead.status) === statusFilter)
  ), [leads, statusFilter]);

  const handleDelete = async (leadId: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) {
      toast.error('Erro ao excluir lead');
      return;
    }
    setLeads(prev => prev.filter(l => l.id !== leadId));
    toast.success('Lead excluído');
  };

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
    if (error) {
      toast.error('Erro ao atualizar status');
      return;
    }
    setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status } : lead));
  };

  const addHistoryMessage = (leadId: string) => {
    const draft = historyDrafts[leadId]?.trim();
    if (!draft) return;
    const timestamp = new Date().toLocaleString('pt-BR');
    setLeads(prev => prev.map(lead => {
      if (lead.id !== leadId) return lead;
      const previous = lead.message ? `${lead.message}\n\n` : '';
      return { ...lead, message: `${previous}[${timestamp}] ${draft}` };
    }));
    supabase.from('leads').update({ message: `${leads.find(l => l.id === leadId)?.message || ''}\n\n[${timestamp}] ${draft}`.trim() }).eq('id', leadId).then(({ error }) => {
      if (error) toast.error('Erro ao salvar histórico');
    });
    setHistoryDrafts(prev => ({ ...prev, [leadId]: '' }));
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
      .then(({ data }) => { if (data) setLeads(data); });
  }, [provider]);

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
                    {lead.message && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-sans text-xs text-muted-foreground">{lead.message}</pre>}
                  </div>
                  <div className="shrink-0 space-y-2 sm:text-right">
                    <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
                    <Select value={status} onValueChange={(value) => handleStatusChange(lead.id, value as LeadStatus)}>
                      <SelectTrigger className="h-8 w-full sm:w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Novo</SelectItem>
                        <SelectItem value="in_progress">Em andamento</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Phone className="h-3 w-3" /> {lead.phone}</a>
                      <motion.a href={whatsappLink(lead.phone, `Olá ${lead.client_name}, recebi sua solicitação${lead.service_needed ? ` sobre "${lead.service_needed}"` : ''}. Como posso ajudar?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full bg-accent p-1.5 text-accent-foreground transition-colors hover:bg-accent/90" title="Responder pelo WhatsApp" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><MessageCircle className="h-4 w-4" /></motion.a>
                      <motion.button onClick={() => handleDelete(lead.id)} className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-1.5 text-destructive transition-colors hover:bg-destructive/20" title="Excluir lead" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Trash2 className="h-4 w-4" /></motion.button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input value={historyDrafts[lead.id] || ''} onChange={(event) => setHistoryDrafts(prev => ({ ...prev, [lead.id]: event.target.value }))} placeholder="Adicionar histórico de conversa" className="h-9 text-xs" maxLength={500} />
                  <Button size="sm" variant="outline" onClick={() => addHistoryMessage(lead.id)} className="gap-1"><Send className="h-3 w-3" />Salvar</Button>
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