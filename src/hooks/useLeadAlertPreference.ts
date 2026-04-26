/**
 * Preferência de alerta de novos leads (sound | toast | both | off).
 * Persiste em `public.lead_alert_preferences` (uma linha por usuário).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type LeadAlertMode = 'off' | 'sound' | 'toast' | 'both';

const STORAGE_KEY = 'lead_alert_mode_v1';
const DEFAULT_MODE: LeadAlertMode = 'both';

export function useLeadAlertPreference() {
  const { user } = useAuth();
  const [mode, setModeState] = useState<LeadAlertMode>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return (cached as LeadAlertMode) || DEFAULT_MODE;
  });
  const [loading, setLoading] = useState(false);

  // Carrega preferência remota ao montar
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('lead_alert_preferences' as any)
        .select('mode')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      const remote = (data as any)?.mode as LeadAlertMode | undefined;
      if (remote) {
        setModeState(remote);
        localStorage.setItem(STORAGE_KEY, remote);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const setMode = useCallback(async (next: LeadAlertMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    if (!user?.id) return;
    setLoading(true);
    const { error } = await supabase
      .from('lead_alert_preferences' as any)
      .upsert({ user_id: user.id, mode: next, updated_at: new Date().toISOString() } as any);
    setLoading(false);
    if (error) {
      toast.error('Não foi possível salvar a preferência');
    } else {
      toast.success('Preferência de alertas atualizada');
    }
  }, [user?.id]);

  return { mode, setMode, loading };
}
