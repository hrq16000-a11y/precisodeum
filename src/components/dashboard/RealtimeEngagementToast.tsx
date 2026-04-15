import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const ACTION_LABELS: Record<string, { emoji: string; message: string }> = {
  review_received: { emoji: '⭐', message: 'Você recebeu uma nova avaliação!' },
  review_5_stars: { emoji: '🌟', message: 'Uma avaliação 5 estrelas! Incrível!' },
  lead_received: { emoji: '📩', message: 'Novo lead recebido!' },
  service_created: { emoji: '🔧', message: 'Serviço registrado com sucesso!' },
  portfolio_photo_added: { emoji: '📸', message: 'Foto do portfólio contabilizada!' },
  profile_photo_uploaded: { emoji: '📷', message: 'Foto de perfil atualizada!' },
  profile_completed: { emoji: '✅', message: 'Perfil completado!' },
};

const RealtimeEngagementToast = () => {
  const { user } = useAuth();
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

          const info = ACTION_LABELS[row.action_key] || { emoji: '🏆', message: 'Ação reconhecida!' };
          const points = row.points_awarded || 0;

          if (points > 0) {
            toast.success(`${info.emoji} +${points} pontos de Engajamento!`, {
              description: `${info.message} Continue subindo no ranking!`,
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
};

export default RealtimeEngagementToast;
