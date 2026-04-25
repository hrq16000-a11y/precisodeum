import { useState } from 'react';
import { CheckCircle2, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { celebrate } from '@/lib/celebrate';
import { whatsappLink } from '@/lib/whatsapp';

interface Props {
  leadId: string;
  providerId: string;
  clientPhone: string;
  clientName?: string | null;
  isConcluded: boolean;
  onConcluded?: () => void;
}

/**
 * Ações de fechamento do lead:
 * - Concluir Serviço → RPC mark_lead_as_concluded (+20 pts) + confete
 * - Solicitar Avaliação → usa RPC get_review_short_link p/ montar mensagem WhatsApp
 */
export default function LeadConcludeActions({
  leadId,
  providerId,
  clientPhone,
  clientName,
  isConcluded,
  onConcluded,
}: Props) {
  const [closing, setClosing] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const handleConclude = async () => {
    if (closing || isConcluded) return;
    setClosing(true);
    try {
      const { data, error } = await supabase.rpc('mark_lead_as_concluded' as any, { _lead_id: leadId });
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === 'concluded') {
        celebrate({ intensity: 'big', id: `lead-concluded:${leadId}` });
        toast.success('Serviço concluído! 🎉', {
          description: '+20 pontos de engajamento creditados no seu perfil.',
          duration: 6000,
        });
        onConcluded?.();
      } else if (status === 'already_concluded') {
        toast.info('Este lead já estava marcado como concluído.');
        onConcluded?.();
      } else if (status === 'forbidden') {
        toast.error('Você não tem permissão para concluir este lead.');
      } else {
        toast.error('Não foi possível concluir o lead agora.');
      }
    } catch (e) {
      console.error('[mark_lead_as_concluded]', e);
      toast.error('Erro ao concluir o serviço. Tente novamente.');
    } finally {
      setClosing(false);
    }
  };

  const handleReview = async () => {
    if (reviewing) return;
    setReviewing(true);
    try {
      const { data, error } = await supabase.rpc('get_review_short_link' as any, { _provider_id: providerId });
      if (error) throw error;
      const payload = data as any;
      if (payload?.status !== 'ok') {
        toast.error('Não foi possível gerar o link de avaliação.');
        return;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://precisodeum.com.br';
      const url = `${origin}${payload.review_path}`;
      const greeting = clientName ? `Olá ${clientName.split(' ')[0]}` : 'Olá';
      const message = `${greeting}, obrigado por confiar no meu trabalho! Poderia me avaliar no Preciso de Um? ${url}`;
      const link = whatsappLink(clientPhone, message);
      window.open(link, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp aberto com mensagem de avaliação.');
    } catch (e) {
      console.error('[get_review_short_link]', e);
      toast.error('Erro ao gerar link de avaliação.');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <Button
        size="sm"
        onClick={handleConclude}
        disabled={closing || isConcluded}
        className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
      >
        {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {isConcluded ? 'Serviço concluído' : 'Concluir Serviço (+20 pts)'}
      </Button>

      {isConcluded && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleReview}
          disabled={reviewing || !clientPhone}
          className="gap-1.5 border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
        >
          {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
          Solicitar Avaliação
        </Button>
      )}

      <p className="basis-full text-[11px] text-muted-foreground">
        {isConcluded
          ? 'Lead concluído. Convide o cliente a deixar uma avaliação para subir no ranking.'
          : 'Marque como concluído quando o serviço for realizado para ganhar pontos de engajamento.'}
      </p>
    </div>
  );
}
