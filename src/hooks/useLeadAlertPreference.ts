/**
 * Preferência de alerta de novos leads.
 *
 * Configurações:
 * - `mode`: `off` | `sound` | `toast` | `both` — tipo de alerta.
 * - `minIntervalSeconds`: intervalo anti-spam (0–3600s) entre dois alertas
 *   audíveis/visuais consecutivos. `0` = sem throttle.
 *
 * Persiste em `public.lead_alert_preferences` (uma linha por usuário) e
 * mantém um espelho em `localStorage` para resposta instantânea no F5.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthIdentity } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type LeadAlertMode = 'off' | 'sound' | 'toast' | 'both';

const STORAGE_KEY_MODE = 'lead_alert_mode_v1';
const STORAGE_KEY_INTERVAL = 'lead_alert_min_interval_v1';
const DEFAULT_MODE: LeadAlertMode = 'both';
const DEFAULT_INTERVAL = 0;
const MAX_INTERVAL = 3600;

const clampInterval = (n: unknown): number => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(MAX_INTERVAL, Math.floor(v));
};

export function useLeadAlertPreference() {
  const { user } = useAuthIdentity();
  const [mode, setModeState] = useState<LeadAlertMode>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_MODE) : null;
    return (cached as LeadAlertMode) || DEFAULT_MODE;
  });
  const [minIntervalSeconds, setIntervalState] = useState<number>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_INTERVAL) : null;
    return clampInterval(cached ?? DEFAULT_INTERVAL);
  });
  const [loading, setLoading] = useState(false);

  // Carrega preferência remota ao montar
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('lead_alert_preferences' as any)
        .select('mode, min_interval_seconds')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      const remoteMode = (data as any)?.mode as LeadAlertMode | undefined;
      const remoteInterval = (data as any)?.min_interval_seconds;
      if (remoteMode) {
        setModeState(remoteMode);
        localStorage.setItem(STORAGE_KEY_MODE, remoteMode);
      }
      if (remoteInterval !== undefined && remoteInterval !== null) {
        const clamped = clampInterval(remoteInterval);
        setIntervalState(clamped);
        localStorage.setItem(STORAGE_KEY_INTERVAL, String(clamped));
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const persist = useCallback(async (patch: { mode?: LeadAlertMode; min_interval_seconds?: number }) => {
    if (!user?.id) return null;
    setLoading(true);
    const { error } = await supabase
      .from('lead_alert_preferences' as any)
      .upsert({
        user_id: user.id,
        ...patch,
        updated_at: new Date().toISOString(),
      } as any);
    setLoading(false);
    return error;
  }, [user?.id]);

  const setMode = useCallback(async (next: LeadAlertMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY_MODE, next);
    const error = await persist({ mode: next });
    if (error) toast.error('Não foi possível salvar a preferência');
    else toast.success('Preferência de alertas atualizada');
  }, [persist]);

  const setMinIntervalSeconds = useCallback(async (next: number) => {
    const clamped = clampInterval(next);
    setIntervalState(clamped);
    localStorage.setItem(STORAGE_KEY_INTERVAL, String(clamped));
    const error = await persist({ min_interval_seconds: clamped });
    if (error) toast.error('Não foi possível salvar o intervalo');
    else toast.success(clamped === 0 ? 'Anti-spam desativado' : `Intervalo definido: ${clamped}s`);
  }, [persist]);

  return { mode, setMode, minIntervalSeconds, setMinIntervalSeconds, loading };
}
