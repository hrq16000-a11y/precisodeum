/**
 * useLeadHistoryAuthors — resolve nomes/avatares dos autores do histórico via RPC.
 * Uso: const { authors } = useLeadHistoryAuthors(authorIds);
 *      authors[id]?.full_name
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadHistoryAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useLeadHistoryAuthors(authorIds: string[]) {
  const unique = Array.from(new Set(authorIds.filter(Boolean)));
  const key = unique.slice().sort().join(',');

  const query = useQuery({
    queryKey: ['lead-history-authors', key],
    enabled: unique.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('get_lead_history_authors', { p_author_ids: unique });
      if (error) throw error;
      const map: Record<string, LeadHistoryAuthor> = {};
      for (const a of (data || []) as LeadHistoryAuthor[]) map[a.id] = a;
      return map;
    },
  });

  return { authors: query.data || {}, isLoading: query.isLoading };
}
