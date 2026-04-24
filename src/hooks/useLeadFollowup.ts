import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'completed' | 'lost';

export interface LeadRow {
  id: string;
  client_name: string;
  phone: string;
  service_needed: string | null;
  message: string | null;
  status: LeadStatus;
  lead_score: number;
  created_at: string;
  last_status_at: string;
  next_followup_at: string | null;
  followup_window_hours: number;
  last_followup_notified_at: string | null;
}

export interface LeadHistoryEntry {
  id: string;
  lead_id: string;
  entry_type: string;
  old_status: string | null;
  new_status: string | null;
  message: string | null;
  created_at: string;
}

export const FOLLOWUP_WINDOWS = [12, 24, 48, 72] as const;
export type FollowupWindow = typeof FOLLOWUP_WINDOWS[number];

export const STATUS_META: Record<LeadStatus, { label: string; tone: string; dot: string }> = {
  new:       { label: 'Novo',      tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',         dot: 'bg-blue-500' },
  contacted: { label: 'Contatado', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',     dot: 'bg-amber-500' },
  scheduled: { label: 'Agendado',  tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30', dot: 'bg-violet-500' },
  completed: { label: 'Concluído', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  lost:      { label: 'Perdido',   tone: 'bg-muted text-muted-foreground border-border',                                dot: 'bg-muted-foreground' },
};

export function useProviderLeads(providerId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['provider-leads', providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, client_name, phone, service_needed, message, status, lead_score, created_at, last_status_at, next_followup_at, followup_window_hours, last_followup_notified_at')
        .eq('provider_id', providerId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as LeadRow[];
    },
    staleTime: 30_000,
  });

  // Realtime: refetch quando algum lead deste provider mudar
  useEffect(() => {
    if (!providerId) return;
    const channel = supabase
      .channel(`provider-leads-${providerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
        filter: `provider_id=eq.${providerId}`,
      }, () => queryClient.invalidateQueries({ queryKey: ['provider-leads', providerId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [providerId, queryClient]);

  return query;
}

export function useLeadHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-history', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_history')
        .select('id, lead_id, entry_type, old_status, new_status, message, created_at')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LeadHistoryEntry[];
    },
    staleTime: 30_000,
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: LeadStatus }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Lead marcado como ${STATUS_META[vars.status].label.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['provider-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-history', vars.leadId] });
    },
    onError: (e) => toast.error('Não foi possível atualizar o lead', { description: (e as Error).message }),
  });
}

export function useFollowupWindow(providerId: string | undefined, currentValue: number | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hours: FollowupWindow) => {
      if (!providerId) throw new Error('Provider ausente');
      const { error } = await supabase
        .from('providers')
        .update({ lead_followup_hours: hours } as any)
        .eq('id', providerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Janela de lembrete atualizada');
      queryClient.invalidateQueries({ queryKey: ['provider', user?.id] });
    },
    onError: (e) => toast.error('Não foi possível salvar a janela', { description: (e as Error).message }),
  });
}

/** Verifica se um lead está com follow-up vencido (em aberto além da janela) */
export function isOverdue(lead: LeadRow): boolean {
  if (!lead.next_followup_at) return false;
  if (!['new', 'contacted'].includes(lead.status)) return false;
  return new Date(lead.next_followup_at).getTime() <= Date.now();
}
