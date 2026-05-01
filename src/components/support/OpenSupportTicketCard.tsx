import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LifeBuoy, Send, Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Card de "Abrir um ticket" para usar dentro da Central de Ajuda.
 * - Não autenticado: mostra CTA para login (preserva ?next=/dashboard/suporte).
 * - Autenticado: form com assunto + descrição que cria/usa o ticket ativo
 *   e insere a 1ª mensagem; depois redireciona para /dashboard/suporte.
 */
export default function OpenSupportTicketCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const submit = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Faça login para abrir um ticket');
      if (!description.trim()) throw new Error('Descreva sua dúvida');

      // Reutiliza ticket ativo ou cria um novo
      const { data: existing } = await (supabase
        .from('support_tickets' as any)
        .select('id, status, blocked, consecutive_user_msgs')
        .eq('user_id', user.id)
        .neq('status', 'closed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any);

      let ticketId: string;
      if (existing?.id) {
        ticketId = existing.id;
        if (existing.blocked) throw new Error('Seu ticket atual está bloqueado.');
        if (existing.status !== 'open_user') {
          throw new Error('Aguarde a resposta do suporte para enviar uma nova mensagem.');
        }
        if (existing.consecutive_user_msgs >= 3) {
          throw new Error('Você atingiu o limite de 3 mensagens. Aguarde a resposta do suporte.');
        }
      } else {
        const { data: created, error: ce } = await (supabase
          .from('support_tickets' as any)
          .insert({ user_id: user.id, subject: subject.trim() || 'Suporte' } as any)
          .select('id')
          .single() as any);
        if (ce) throw ce;
        ticketId = created.id;
      }

      const { error } = await (supabase
        .from('support_ticket_messages' as any)
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          sender_role: 'user',
          content: description.trim().slice(0, 4000),
        } as any) as any);
      if (error) throw error;
      return ticketId;
    },
    onSuccess: () => {
      toast.success('Ticket aberto! Acompanhe pelo painel de suporte.');
      setSubject('');
      setDescription('');
      navigate('/dashboard/suporte');
    },
    onError: (err: any) => toast.error(err.message || 'Falha ao abrir ticket'),
  });

  if (!user) {
    return (
      <div className="mt-12 rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center">
        <LifeBuoy className="mx-auto h-8 w-8 text-accent mb-2" />
        <h2 className="font-display text-lg font-bold text-foreground">Ainda tem dúvidas?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Faça login para abrir um ticket de suporte e falar diretamente com nossa equipe.
        </p>
        <Link
          to="/login?next=/dashboard/suporte"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:brightness-110 transition-all"
        >
          <LogIn className="h-4 w-4" />
          Entrar para abrir ticket
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-2xl border border-accent/20 bg-accent/5 p-6">
      <div className="flex items-center gap-2 mb-2">
        <LifeBuoy className="h-5 w-5 text-accent" />
        <h2 className="font-display text-lg font-bold text-foreground">Abrir um ticket</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Sua mensagem chega direto ao time de suporte. Você pode enviar até 3 mensagens consecutivas; após isso, aguarde a resposta para continuar.
      </p>
      <div className="space-y-3">
        <Input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Assunto (ex: Problema no cadastro)"
          maxLength={120}
          className="h-10 text-sm"
        />
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descreva sua dúvida ou problema com o máximo de detalhes possível…"
          maxLength={4000}
          className="min-h-[120px] text-sm"
        />
        <div className="flex items-center justify-between">
          <Link to="/dashboard/suporte" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
            Ver meus tickets
          </Link>
          <Button
            onClick={() => submit.mutate()}
            disabled={!description.trim() || submit.isPending}
            className="gap-2"
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Abrir ticket
          </Button>
        </div>
      </div>
    </div>
  );
}
