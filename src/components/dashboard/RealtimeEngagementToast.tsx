import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthIdentity } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from '@/lib/router-compat';

const ACTION_LABELS: Record<string, { label: string; message: string }> = {
  review_received: { label: 'Avaliação', message: 'Você recebeu uma nova avaliação!' },
  review_5_stars: { label: '5 Estrelas', message: 'Uma avaliação 5 estrelas! Incrível!' },
  lead_received: { label: 'Lead', message: 'Novo lead recebido!' },
  service_created: { label: 'Serviço', message: 'Serviço registrado com sucesso!' },
  portfolio_photo_added: { label: 'Portfólio', message: 'Foto do portfólio contabilizada!' },
  profile_photo_uploaded: { label: 'Perfil', message: 'Foto de perfil atualizada!' },
  profile_completed: { label: 'Completo', message: 'Perfil completado!' },
};

// Ações ligadas a indicações — recebem tratamento especial (link para o gráfico)
const REFERRAL_ACTIONS = new Set([
  'referral_qualified',
  'referral_rewarded',
  'referral_first_post',
]);

const REFERRAL_REASON: Record<string, string> = {
  referral_qualified: 'Seu indicado completou o cadastro como profissional.',
  referral_rewarded: 'Seu indicado postou a primeira Obra do Dia.',
  referral_first_post: 'Seu indicado publicou a primeira Obra do Dia.',
};

const RealtimeEngagementToast = () => {
  const { user } = useAuthIdentity();
  const navigate = useNavigate();
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('engagement-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'engagement_log',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (!row || row.id === lastIdRef.current) return;
          lastIdRef.current = row.id;

          const points = row.points_awarded || 0;
          if (points <= 0) return;

          // Notificação especial para indicações: motivo + link para o gráfico
          if (REFERRAL_ACTIONS.has(row.action_key)) {
            const reason = REFERRAL_REASON[row.action_key] || 'Indicação qualificada.';
            const partner = row.metadata?.referred_name || row.metadata?.partner_name;
            const period = new Date(row.created_at || Date.now()).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
            });

            toast.success(`+${points} pontos por indicação qualificada!`, {
              description: `${reason}${partner ? ` (${partner})` : ''} · creditados em ${period}`,
              duration: 9000,
              action: {
                label: 'Ver evolução',
                onClick: () => navigate('/dashboard/indicacoes#evolucao'),
              },
            });
            return;
          }

          // Demais ações — mensagem genérica
          const info = ACTION_LABELS[row.action_key] || {
            label: 'Ação',
            message: 'Ação reconhecida!',
          };
          toast.success(`+${points} pontos de Engajamento!`, {
            description: `${info.message} Continue subindo no ranking!`,
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);

  return null;
};

export default RealtimeEngagementToast;
