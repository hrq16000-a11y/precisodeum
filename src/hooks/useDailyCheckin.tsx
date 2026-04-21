import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CheckinState {
  streak: number;
  doneToday: boolean;
  loading: boolean;
}

/**
 * Hook para gerenciar check-in diário do usuário.
 * - Lê streak atual e se já fez hoje.
 * - register() chama a RPC `register_daily_checkin` no banco.
 */
export const useDailyCheckin = () => {
  const { user } = useAuth();
  const [state, setState] = useState<CheckinState>({ streak: 0, doneToday: false, loading: true });

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setState({ streak: 0, doneToday: false, loading: false });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await (supabase as any)
      .from('daily_checkins')
      .select('checkin_date, streak_count')
      .eq('user_id', user.id)
      .order('checkin_date', { ascending: false })
      .limit(1);
    const last = data?.[0];
    setState({
      streak: last?.streak_count ?? 0,
      doneToday: last?.checkin_date === today,
      loading: false,
    });
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const register = useCallback(async () => {
    if (!user?.id) return null;
    const { data, error } = await (supabase as any).rpc('register_daily_checkin');
    if (error) {
      toast.error('Não foi possível registrar o check-in.');
      return null;
    }
    if (data?.already_done_today) {
      toast.info(`Você já fez check-in hoje. Streak atual: ${data.streak}`);
    } else {
      toast.success(`+5 pontos! Streak: ${data.streak} ${data.streak === 1 ? 'dia' : 'dias'}`);
      if (data.milestone_7d) {
        toast.success('🎉 7 dias seguidos! +100 pontos de bônus!', { duration: 6000 });
      }
    }
    await refresh();
    return data;
  }, [user?.id, refresh]);

  return { ...state, register, refresh };
};
