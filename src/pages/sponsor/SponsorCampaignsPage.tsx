import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone } from 'lucide-react';

const SponsorCampaignsPage = () => {
  const { sponsor, loading } = useSponsorAuth();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['sponsor-campaigns', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_campaigns' as any)
        .select('*')
        .eq('sponsor_id', sponsor!.id)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  if (loading || isLoading) {
    return (
      <SponsorLayout>
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
      </SponsorLayout>
    );
  }

  const statusMap: Record<string, string> = {
    draft: 'Rascunho',
    active: 'Ativa',
    paused: 'Pausada',
    completed: 'Concluída',
  };

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>

        {campaigns && campaigns.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((c: any) => (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Megaphone className="h-4 w-4" /> {c.name}
                    </CardTitle>
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                      {statusMap[c.status] || c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {c.description && <p className="text-muted-foreground">{c.description}</p>}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {c.start_date && <span>Início: {new Date(c.start_date).toLocaleDateString('pt-BR')}</span>}
                    {c.end_date && <span>Fim: {new Date(c.end_date).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {c.budget > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Orçamento: R$ {Number(c.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma campanha cadastrada.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorCampaignsPage;
