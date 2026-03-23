import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

const SponsorContractsPage = () => {
  const { sponsor, loading } = useSponsorAuth();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['sponsor-contracts', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsor_contracts' as any)
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
    active: 'Ativo',
    expired: 'Expirado',
    cancelled: 'Cancelado',
  };

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Contratos</h1>

        {contracts && contracts.length > 0 ? (
          <div className="space-y-4">
            {contracts.map((c: any) => (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {c.contract_number || 'Contrato sem número'}
                    </CardTitle>
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                      {statusMap[c.status] || c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {c.start_date && <span>Início: {new Date(c.start_date).toLocaleDateString('pt-BR')}</span>}
                    {c.end_date && <span>Fim: {new Date(c.end_date).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {c.value > 0 && (
                    <p className="text-muted-foreground">
                      Valor: R$ {Number(c.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum contrato registrado.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorContractsPage;
