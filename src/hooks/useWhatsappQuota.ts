import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthIdentity } from '@/hooks/useAuth';

export type WhatsappQuota = {
  used_today: number;
  remaining_today: number;
  daily_limit: number;
};

export type WhatsappClickResult = WhatsappQuota & {
  status: 'ok';
  reused: boolean;
};

const QUOTA_KEY = ['whatsapp-quota-today'] as const;

/** Reads daily quota for the current user via RPC `get_whatsapp_clicks_today`. */
export function useWhatsappQuota(enabled = true) {
  const { user } = useAuthIdentity();
  return useQuery<WhatsappQuota>({
    queryKey: QUOTA_KEY,
    enabled: enabled && !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_whatsapp_clicks_today');
      if (error) throw error;
      const d = (data ?? {}) as Partial<WhatsappQuota>;
      return {
        used_today: Number(d.used_today ?? 0),
        remaining_today: Number(d.remaining_today ?? 3),
        daily_limit: Number(d.daily_limit ?? 3),
      };
    },
  });
}

export class WhatsappQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsappQuotaExceededError';
  }
}

/** Mutation that registers the click (or reuses today's record) via RPC. */
export function useRegisterWhatsappClick() {
  const qc = useQueryClient();
  return useMutation<WhatsappClickResult, Error, { providerId: string }>({
    mutationFn: async ({ providerId }) => {
      const { data, error } = await supabase.rpc('check_and_log_whatsapp_click', {
        p_provider_id: providerId,
      });
      if (error) {
        // Postgres custom error P0001 → quota exceeded
        const code = (error as any).code;
        const msg = error.message ?? '';
        if (code === 'P0001' || /Limite diario/i.test(msg)) {
          throw new WhatsappQuotaExceededError(
            'Limite diario de 3 contatos atingido. Volte amanha ou consulte Meus Contatos no painel.',
          );
        }
        throw error;
      }
      const d = (data ?? {}) as Partial<WhatsappClickResult>;
      return {
        status: 'ok',
        reused: Boolean(d.reused),
        used_today: Number(d.used_today ?? 0),
        remaining_today: Number(d.remaining_today ?? 0),
        daily_limit: Number(d.daily_limit ?? 3),
      };
    },
    onSuccess: (result) => {
      qc.setQueryData(QUOTA_KEY, {
        used_today: result.used_today,
        remaining_today: result.remaining_today,
        daily_limit: result.daily_limit,
      });
      qc.invalidateQueries({ queryKey: ['whatsapp-contacts-history'] });
    },
  });
}
