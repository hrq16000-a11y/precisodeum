import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIsStandalone } from '@/hooks/usePwaInstall';
import {
  getPresenceVisibility,
  setPresenceVisibility,
  useIsProviderOnline,
} from '@/hooks/useOnlinePresence';

/**
 * Lógica complementar do PWA para PROFISSIONAIS:
 *  1. Quando o app abre em standalone + usuário logado → completa missão
 *     "app_installed" (+30 pts) uma única vez (idempotente).
 *  2. Smart Reminder: se abrir o app via standalone e estiver offline,
 *     mostra um toast convidando a ficar online.
 *
 * Este hook NÃO modifica o módulo blindado de PWA — usa apenas
 * useIsStandalone como leitura.
 */
export function usePwaMission(userId: string | undefined, providerId: string | undefined) {
  const isStandalone = useIsStandalone();
  const isOnline = useIsProviderOnline(userId);
  const missionFiredRef = useRef(false);
  const reminderFiredRef = useRef(false);
  const queryClient = useQueryClient();

  // 1) Missão "App Instalado" (+30 pts)
  useEffect(() => {
    if (!userId || !providerId || !isStandalone || missionFiredRef.current) return;

    const awardedKey = `pwa_mission_app_installed_${userId}`;
    if (localStorage.getItem(awardedKey) === '1') {
      missionFiredRef.current = true;
      return;
    }
    missionFiredRef.current = true;

    void (async () => {
      // Audita abertura standalone (não-bloqueante)
      void supabase.rpc('log_pwa_install_event', {
        _event: 'standalone_opened',
        _meta: {},
      });

      const { data, error } = await supabase.rpc('complete_app_install_mission');
      if (error) {
        missionFiredRef.current = false;
        return;
      }
      localStorage.setItem(awardedKey, '1');
      const result = data as { status?: string; points_awarded?: number } | null;
      if (result?.status === 'granted') {
        toast.success('App instalado! +30 pontos de visibilidade!', {
          description: 'Missão "App no Bolso" concluída — você está mais perto do topo do ranking.',
          duration: 7000,
        });
        queryClient.invalidateQueries({ queryKey: ['engagement-points'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    })();
  }, [userId, providerId, isStandalone, queryClient]);

  // 2) Smart Reminder — abriu via app e está offline
  useEffect(() => {
    if (!userId || !isStandalone || reminderFiredRef.current) return;
    // Pequeno delay para deixar o canal de presença estabilizar
    const t = setTimeout(() => {
      if (reminderFiredRef.current) return;
      const sessionKey = `pwa_reminder_shown_${userId}`;
      if (sessionStorage.getItem(sessionKey) === '1') return;
      const visible = getPresenceVisibility(userId);
      if (visible || isOnline) return;
      reminderFiredRef.current = true;
      sessionStorage.setItem(sessionKey, '1');
      toast('Bem-vindo de volta!', {
        description: 'Que tal ficar online para receber buscas de agora?',
        duration: 8000,
        action: {
          label: 'Ficar Online',
          onClick: () => setPresenceVisibility(userId, true),
        },
      });
    }, 3500);
    return () => clearTimeout(t);
  }, [userId, isStandalone, isOnline]);
}
