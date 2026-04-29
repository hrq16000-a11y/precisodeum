import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Flame } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * "Ping de Sucesso" — escuta inserts em lead_interactions do prestador logado
 * e dispara um toast de celebração quando alguém clica no WhatsApp/telefone.
 *
 * Roda passivamente no DashboardPage. Usa Supabase Realtime.
 * Throttle de 30s entre toasts para evitar spam em rajadas.
 */
export function useLeadInteractionPing() {
  const { user } = useAuth();
  const lastToastAtRef = useRef<number>(0);
  const providerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Resolve provider.id do usuário logado
      const { data: prov } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (cancelled || !prov?.id) return;
      providerIdRef.current = prov.id;

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

            // Throttle 30s
            const now = Date.now();
            if (now - lastToastAtRef.current < 30_000) return;
            lastToastAtRef.current = now;

            const channelLabel = row.interaction_type === 'whatsapp' ? 'WhatsApp' : 'telefone';
            toast.success(`Alguém acabou de clicar no seu ${channelLabel}!`, {
              description: 'Seu anúncio Padrão Ouro está funcionando — fique atento ao seu chat.',
              duration: 6000,
              icon: <Flame className="h-4 w-4 text-amber-500" />,
            });
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
