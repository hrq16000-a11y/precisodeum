import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  status: 'open_user' | 'open_admin' | 'closed';
  consecutive_user_msgs: number;
  user_city: string | null;
  user_full_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_admin: number;
  unread_user: number;
  blocked: boolean;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  content: string;
  read: boolean;
  created_at: string;
};

/** Regra das 3 mensagens consecutivas: o usuário só pode enviar enquanto status = open_user. */
export function canUserSend(ticket: SupportTicket | null | undefined): boolean {
  if (!ticket) return false;
  if (ticket.blocked || ticket.status === 'closed') return false;
  return ticket.status === 'open_user' && ticket.consecutive_user_msgs < 3;
}

export function userRemainingMessages(ticket: SupportTicket | null | undefined): number {
  if (!ticket || ticket.status !== 'open_user') return 0;
  return Math.max(0, 3 - ticket.consecutive_user_msgs);
}

export function useMyTicket() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['support-ticket', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase
        .from('support_tickets' as any)
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      return (data || null) as SupportTicket | null;
    },
  });
}

export function useTicketMessages(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ['support-ticket-messages', ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data } = await (supabase
        .from('support_ticket_messages' as any)
        .select('*')
        .eq('ticket_id', ticketId!)
        .order('created_at', { ascending: true })
        .limit(500) as any);
      return (data || []) as SupportMessage[];
    },
  });
}

export function useOpenOrCreateTicket() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subject?: string) => {
      if (!user?.id) throw new Error('Não autenticado');
      const { data: existing } = await (supabase
        .from('support_tickets' as any)
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'closed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      if (existing) return existing as SupportTicket;
      const { data, error } = await (supabase
        .from('support_tickets' as any)
        .insert({ user_id: user.id, subject: subject || 'Suporte' } as any)
        .select('*')
        .single() as any);
      if (error) throw error;
      return data as SupportTicket;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-ticket'] }),
  });
}

export function useSendUserMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: string; content: string }) => {
      const trimmed = content.trim();
      if (!trimmed) throw new Error('Mensagem vazia');
      const { error } = await (supabase
        .from('support_ticket_messages' as any)
        .insert({
          ticket_id: ticketId,
          sender_id: user!.id,
          sender_role: 'user',
          content: trimmed.slice(0, 4000),
        } as any) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['support-ticket-messages', vars.ticketId] });
      qc.invalidateQueries({ queryKey: ['support-ticket'] });
    },
  });
}
