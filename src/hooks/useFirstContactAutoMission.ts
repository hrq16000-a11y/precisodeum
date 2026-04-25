import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useContactImpact } from '@/hooks/useContactImpact';
import { celebrate } from '@/lib/celebrate';

/**
 * Detecta o primeiro clique de WhatsApp recebido pelo profissional e marca
 * a missão `first_contact` automaticamente. Idempotente no servidor.
 * Mostra toast celebrativo + animação confetti.
 */
export function useFirstContactAutoMission() {
  const { provider, refetchProfile } = useAuth();
  const { data } = useContactImpact();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (!provider?.id) return;
    if (triggeredRef.current) return;
    const answers = (provider as any)?.mission_answers ?? {};
    if (answers.first_contact) {
      triggeredRef.current = true;
      return;
    }
    const clicks = data?.whatsapp_clicks ?? 0;
    if (clicks <= 0) return;

    triggeredRef.current = true;

    void (async () => {
      try {
        const { data: rpc, error } = await supabase.rpc(
          'complete_first_contact_mission' as any,
          { _provider_id: provider.id }
        );
        if (error) throw error;
        const status = (rpc as any)?.status as string | undefined;
        if (status === 'completed') {
          celebrate();
          toast.success('Primeiro contato recebido! 🎉', {
            description: 'Missão "Primeiro Lead" concluída — +5 pontos no seu perfil.',
            duration: 6000,
          });
          await refetchProfile();
        }
      } catch {
        // silencioso — operação opcional
      }
    })();
  }, [provider?.id, (provider as any)?.mission_answers, data?.whatsapp_clicks, refetchProfile]);
}
