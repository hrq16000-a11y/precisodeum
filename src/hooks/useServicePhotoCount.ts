/**
 * useServicePhotoCount — conta fotos do `service_images` em tempo real.
 *
 * Usado pelo WizardEncouragement nas fases phase2_* para refletir
 * dinamicamente "Fotos: X/5" no checklist conforme o usuário sobe imagens
 * (sem esperar a próxima navegação).
 *
 * Estratégia: fetch inicial + subscription em postgres_changes do canal
 * `service_images:service_id=eq.<id>`. Fail-soft: erro de rede mantém 0.
 *
 * SSR-safe e idempotente (cancela canal no unmount/troca de id).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useServicePhotoCount(serviceId: string | null | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!serviceId) {
      setCount(0);
      return;
    }
    let active = true;

    const fetchCount = async () => {
      const { count: c } = await (supabase as any)
        .from('service_images')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId);
      if (active) setCount(typeof c === 'number' ? c : 0);
    };

    void fetchCount();

    const channel = supabase
      .channel(`svc-photos-${serviceId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'service_images', filter: `service_id=eq.${serviceId}` },
        () => { void fetchCount(); },
      )
      .subscribe();

    return () => {
      active = false;
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    };
  }, [serviceId]);

  return count;
}
