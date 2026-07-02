import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { supabase } from '@/integrations/supabase/client';
import SponsorChangeRequestForm from '@/components/sponsors/SponsorChangeRequestForm';
import SponsorChangeRequestList from '@/components/sponsors/SponsorChangeRequestList';
import { Loader2 } from 'lucide-react';
import type { ChangeRequestRow } from '@/lib/sponsorSelfService';

const SponsorSelfServicePage = () => {
  const { sponsor, loading } = useSponsorAuth();

  const requestsQuery = useQuery({
    queryKey: ['sponsor-change-requests', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsor_change_requests' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as unknown as ChangeRequestRow[]) || [];
    },
  });

  const refetch = useCallback(() => {
    requestsQuery.refetch();
  }, [requestsQuery]);

  if (loading || !sponsor) {
    return (
      <SponsorLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      </SponsorLayout>
    );
  }

  const rows = requestsQuery.data || [];
  const hasPending = rows.some((r) => r.status === 'pending');

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Editar campanha</h1>
          <p className="text-sm text-muted-foreground">
            Alterações são revisadas pelo administrador antes de irem ao ar.
          </p>
        </div>

        <SponsorChangeRequestForm
          sponsorId={sponsor.id}
          snapshot={sponsor as unknown as Record<string, unknown>}
          hasPending={hasPending}
          onSubmitted={refetch}
        />

        <SponsorChangeRequestList rows={rows} onChanged={refetch} />
      </div>
    </SponsorLayout>
  );
};

export default SponsorSelfServicePage;
