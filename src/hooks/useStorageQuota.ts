import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StorageQuota {
  usedMB: number;
  limitMB: number;
  percentUsed: number;
  isOverLimit: boolean;
}

export const useStorageQuota = () => {
  const { user } = useAuth();

  return useQuery<StorageQuota>({
    queryKey: ['storage-quota', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      // Get user_ref
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_ref, account_type_id')
        .eq('id', user!.id)
        .maybeSingle();

      if (!profile?.user_ref) return { usedMB: 0, limitMB: 100, percentUsed: 0, isOverLimit: false };

      // Get storage usage
      const { data: usedMB } = await supabase.rpc('get_user_storage_usage' as any, {
        _user_ref: profile.user_ref,
      });

      // Get account limit
      let limitMB = 100;
      if (profile.account_type_id) {
        const { data: accountType } = await supabase
          .from('account_types')
          .select('storage_limit_mb')
          .eq('id', profile.account_type_id)
          .maybeSingle();
        limitMB = (accountType as any)?.storage_limit_mb ?? 100;
      }

      const used = Number(usedMB) || 0;
      return {
        usedMB: used,
        limitMB,
        percentUsed: limitMB > 0 ? Math.round((used / limitMB) * 100) : 0,
        isOverLimit: used >= limitMB,
      };
    },
  });
};
