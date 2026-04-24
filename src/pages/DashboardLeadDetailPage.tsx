import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Phone, MessageCircle, AlertTriangle, Clock, Timer, History, Send, Paperclip, CalendarClock, Trash2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { whatsappLink } from '@/lib/whatsapp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RescheduleFollowupDialog from '@/components/leads/RescheduleFollowupDialog';
import { useUpdateLeadStatus, STATUS_META, isOverdue, type LeadStatus, type LeadRow, type LeadHistoryEntry } from '@/hooks/useLeadFollowup';

const STATUS_KEYS: LeadStatus[] = ['new', 'contacted', 'scheduled', 'completed', 'lost'];

const DashboardLeadDetailPage = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { user, provider, profile, loading } = useAuth();
  const updateStatus = useUpdateLeadStatus();
  const [draft, setDraft] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  useEffect(() => { if (!loading && !user) navigate('/login'); }, [loading, user, navigate]);

  const leadQuery = useQuery({
    queryKey: ['lead-detail', leadId],
    enabled: !!leadId && !!provider?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, client_name, phone, service_needed, message, status, lead_score, created_at, last_status_at, next_followup_at, followup_window_hours, last_followup_notified_at, provider_id')
        .eq('id', leadId!)
        .eq('provider_id', provider!.id)
        .maybeSingle();
      if (error) throw error;
      return data as LeadRow | null;
    },
  });

  const historyQuery = useQuery({
    queryKey: ['lead-detail-history', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_history' as any)
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LeadHistoryEntry[];
    },
  });

  // Realtime: refetch lead + history quando algo mudar
  useEffect(() => {
    if (!leadId) return;
    const ch = supabase
      .channel(`lead-detail-${leadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `id=eq.${leadId}` }, () => leadQuery.refetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_history', filter: `lead_id=eq.${leadId}` }, () => historyQuery.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lead = leadQuery.data;
  const history = historyQuery.data || [];
  const overdue = useMemo(() => (lead ? isOverdue(lead) : false), [lead]);

  if (loading || leadQuery.isLoading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold text-foreground">Lead não encontrado</p>
          <p className="text-sm text-muted-foreground">Talvez ele tenha sido excluído ou não pertença ao seu perfil.</p>
          <Button className="mt-4" onClick={() => navigate('/dashboard/leads')} variant="outline"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Button>
        </div>
      </DashboardLayout>
    );
  }

  const meta = STATUS_META[lead.status];

  const addNote = async () => {
    if (!draft.trim() || !user) return;
    const { error } = await supabase.from('lead_history' as any).insert({
      lead_id: lead.id, author_id: user.id, entry_type: 'message', message: draft.trim(),
    });
    if (error) { toast.error('Erro ao salvar nota'); return; }
    setDraft('');
    toast.success('Nota adicionada');
    historyQuery.refetch();
  };

  const remove = async () => {
    if (!confirm('Excluir este lead?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', lead.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Lead excluído');
    navigate('/dashboard/leads');
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/leads')} className="gap-1"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <Button variant="outline" size="sm" onClick={remove} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Excluir</Button>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold text-foreground">{lead.client_name}</h1>
          <Badge variant="outline" className={`gap-1 border ${meta.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</Badge>
          <Badge variant="outline">Score {lead.lead_score ?? 0}</Badge>
          {overdue && <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-destructive"><AlertTriangle className="h-3 w-3" /> Follow-up vencido</Badge>}
        </div>
        {lead.service_needed && <p className="mt-2 text-sm font-medium text-accent">{lead.service_needed}</p>}
        {lead.message && <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{lead.message}</p>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground"><Clock className="h-4 w-4 text-primary" /><strong>Recebido</strong></div>
            <p className="mt-1">{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}</p>
            <p>{new Date(lead.created_at).toLocaleString('pt-BR')}</p>
          </div>
          <div className={`rounded-lg border p-3 text-xs ${overdue ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-border bg-muted/20 text-muted-foreground'}`}>
            <div className="flex items-center gap-2 text-foreground"><Timer className="h-4 w-4 text-primary" /><strong>Próximo lembrete</strong></div>
            <p className="mt-1">{lead.next_followup_at ? formatDistanceToNow(new Date(lead.next_followup_at), { addSuffix: true, locale: ptBR }) : '—'}</p>
            <p>{lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString('pt-BR') : 'Nenhum agendado'}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={lead.status} onValueChange={(v) => updateStatus.mutate({ leadId: lead.id, status: v as LeadStatus })}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_KEYS.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
          </Select>
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"><Phone className="h-3.5 w-3.5" /> Ligar</a>
          <a href={whatsappLink(lead.phone, `Olá ${lead.client_name}, recebi sua solicitação. Como posso ajudar?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
          <Button size="sm" variant="outline" onClick={() => setRescheduleOpen(true)} className="gap-1"><CalendarClock className="h-3.5 w-3.5" /> Reagendar follow-up</Button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4 text-primary" /> Histórico e mensagens</div>
        <div className="mt-3 space-y-3">
          {history.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada ainda.</p>}
          {history.map(item => {
            const isStatus = item.entry_type === 'status_change';
            const oldM = isStatus && item.old_status && (STATUS_META as any)[item.old_status];
            const newM = isStatus && item.new_status && (STATUS_META as any)[item.new_status];
            return (
              <div key={item.id} className="border-l-2 border-primary/30 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">{item.entry_type}</Badge>
                  <span className="text-muted-foreground">{item.author_id === user?.id ? (profile?.full_name || 'Você') : 'Sistema'}</span>
                  <span className="text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                </div>
                {isStatus && oldM && newM && <p className="mt-1 text-xs text-muted-foreground">{oldM.label} → <strong className="text-foreground">{newM.label}</strong></p>}
                {item.message && <p className="mt-1 text-sm text-foreground">{item.message}</p>}
                {(item as any).attachment_url && <a className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={(item as any).attachment_url} target="_blank" rel="noreferrer"><Paperclip className="h-3 w-3" />{(item as any).attachment_name || 'Anexo'}</a>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Adicionar nota ao histórico" maxLength={500} />
          <Button onClick={addNote} className="gap-1"><Send className="h-4 w-4" /> Salvar</Button>
        </div>
      </div>

      <RescheduleFollowupDialog
        leadId={lead.id}
        defaultDate={lead.next_followup_at}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onDone={() => { leadQuery.refetch(); historyQuery.refetch(); }}
      />
    </DashboardLayout>
  );
};

export default DashboardLeadDetailPage;
