import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Flame } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { playHornBeep } from '@/lib/soundFx';

/**
 * "Ping de Sucesso" — escuta inserts em lead_interactions do prestador logado
 * e dispara um toast (+ buzina opcional) quando alguém clica no WhatsApp/telefone.
 *
 * Respeita preferências em providers.notification_channels:
 *  - perf_ping  (default true) — controla o toast
 *  - perf_sound (default true) — controla a buzina
 *
 * Throttle de 30s entre toasts para evitar spam em rajadas.
 */
export function useLeadInteractionPing() {
  const { user } = useAuth();
  const lastToastAtRef = useRef<number>(0);
  const prefsRef = useRef<{ ping: boolean; sound: boolean }>({ ping: true, sound: true });

  useEffect(() => {
    if (!user?.id) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: prov } = await supabase
        .from('providers')
        .select('id, notification_channels')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (cancelled || !prov?.id) return;

      const nc = (prov as any).notification_channels as Record<string, boolean> | null;
      prefsRef.current = {
        ping: nc?.perf_ping !== false,
        sound: nc?.perf_sound !== false,
      };

      channel = supabase
        .channel(`lead-ping-${prov.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lead_interactions',
            filter: `provider_id=eq.${prov.id}`,
          },
          (payload) => {
            const row = payload.new as { interaction_type?: string };
            if (!row || !['whatsapp', 'phone'].includes(row.interaction_type ?? '')) return;
            if (!prefsRef.current.ping) return;

            const now = Date.now();
            if (now - lastToastAtRef.current < 30_000) return;
            lastToastAtRef.current = now;

            const channelLabel = row.interaction_type === 'whatsapp' ? 'WhatsApp' : 'telefone';
            toast.success(`Alguém acabou de clicar no seu ${channelLabel}!`, {
              description: 'Seu anúncio está funcionando — fique atento ao seu chat.',
              duration: 6000,
              icon: <Flame className="h-4 w-4 text-amber-500" />,
            });

            if (prefsRef.current.sound) {
              try { playHornBeep(); } catch { /* noop */ }
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
