import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LifeBuoy, Send, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useMyTicket,
  useTicketMessages,
  useOpenOrCreateTicket,
  useSendUserMessage,
  canUserSend,
  userRemainingMessages,
} from '@/hooks/useSupportTicket';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  consumeSupportContext,
  enrichSupportContext,
  buildAutoSubject,
  buildAutoMessage,
  type SupportContext,
} from '@/lib/supportContext';
import { useAuth } from '@/hooks/useAuth';

const DashboardSupportPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: ticket, isLoading } = useMyTicket();
  const openTicket = useOpenOrCreateTicket();
  const send = useSendUserMessage();
  const { data: messages = [] } = useTicketMessages(ticket?.id);
  const [text, setText] = useState('');
  const [pendingCtx, setPendingCtx] = useState<SupportContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pré-preenche o composer e enriquece o contexto com snapshot do perfil.
  useEffect(() => {
    const ctx = consumeSupportContext();
    if (!ctx) return;
    setText((prev) => prev || buildAutoMessage(ctx));
    enrichSupportContext(ctx, user?.id).then(setPendingCtx);
  }, [user?.id]);

  // Realtime
  useEffect(() => {
    if (!ticket?.id) return;
    const ch = supabase
      .channel(`support-ticket-${ticket.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'support_ticket_messages',
        filter: `ticket_id=eq.${ticket.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['support-ticket-messages', ticket.id] });
        qc.invalidateQueries({ queryKey: ['support-ticket'] });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'support_tickets',
        filter: `id=eq.${ticket.id}`,
      }, () => qc.invalidateQueries({ queryKey: ['support-ticket'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticket?.id, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const allowed = canUserSend(ticket);
  const remaining = userRemainingMessages(ticket);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      let t = ticket;
      if (!t) {
        const subject = buildAutoSubject(pendingCtx);
        t = await openTicket.mutateAsync(subject);
        // Persiste o contexto no banco (visível em /admin) — best-effort,
        // não bloqueia o envio em caso de falha de rede/permissão.
        if (pendingCtx && t?.id) {
          try {
            await (supabase
              .from('support_tickets' as any)
              .update({ context: pendingCtx } as any)
              .eq('id', t.id) as any);
            // Log auditável do snapshot do perfil (best-effort).
            const snap = pendingCtx.profile_snapshot;
            if (snap && user?.id) {
              try {
                await (supabase
                  .from('support_context_snapshot_log' as any)
                  .insert({
                    ticket_id: t.id,
                    user_id: user.id,
                    profile_slug: snap.profile_slug ?? null,
                    current_plan: snap.current_plan ?? null,
                    account_level: snap.account_level ?? null,
                    snapshot: snap,
                  } as any) as any);
              } catch { /* noop */ }
            }
          } catch { /* noop */ }
        }
        setPendingCtx(null);
      }
      await send.mutateAsync({ ticketId: t!.id, content: text });
      setText('');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao enviar');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" /> Suporte
          </h1>
          <p className="text-sm text-muted-foreground">
            Abra um ticket e fale direto com nosso time. Você pode enviar até 3 mensagens consecutivas; aguarde a resposta para continuar.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0 flex flex-col h-[60vh] min-h-[420px]">
            {/* Header status */}
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="text-sm font-medium">
                {ticket ? ticket.subject : 'Novo ticket'}
              </div>
              <div className="flex items-center gap-2">
                {ticket?.status === 'open_admin' && (
                  <Badge variant="secondary">Aguardando admin</Badge>
                )}
                {ticket?.status === 'closed' && <Badge variant="outline">Fechado</Badge>}
                {ticket && ticket.status === 'open_user' && (
                  <Badge variant="outline">{remaining} de 3 restantes</Badge>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : !ticket ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Envie sua primeira mensagem para abrir um ticket.
                </p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens ainda.</p>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_role === 'user';
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        isMine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[9px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                          {!isMine && <span className="font-semibold">Suporte · </span>}
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-3 space-y-2">
              {ticket && ticket.status === 'open_admin' && !ticket.blocked && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Você atingiu o limite de 3 mensagens consecutivas. Aguarde a resposta do suporte para continuar.
                </div>
              )}
              {ticket?.blocked && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  Este ticket foi bloqueado pelo administrador.
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={allowed || !ticket ? 'Digite sua mensagem…' : 'Aguarde a resposta do suporte para enviar mais.'}
                  className="min-h-[60px] text-sm flex-1"
                  maxLength={4000}
                  disabled={ticket ? !allowed : false}
                />
                <Button
                  onClick={handleSend}
                  disabled={!text.trim() || send.isPending || openTicket.isPending || (ticket ? !allowed : false)}
                  size="sm"
                  className="gap-1"
                >
                  {(send.isPending || openTicket.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DashboardSupportPage;
