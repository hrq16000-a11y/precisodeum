import { useQuery } from '@tanstack/react-query';
import { Link } from '@/lib/router-compat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  HEALTH_LABEL,
  HEALTH_VARIANT,
  type BillingStatusPayload,
} from '@/lib/sponsorBilling';

interface Props {
  sponsorId: string | null | undefined;
}

const SponsorBillingCard = ({ sponsorId }: Props) => {
  const q = useQuery({
    queryKey: ['sponsor-billing-card', sponsorId],
    enabled: !!sponsorId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sponsor_billing_status' as any, {
        _sponsor_id: sponsorId!,
      });
      if (error) throw error;
      return data as unknown as BillingStatusPayload;
    },
  });

  const data = q.data;
  const health = data?.health || 'healthy';
  const days = data?.days_left;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" />
          Cobrança e renovação
        </CardTitle>
        <Badge variant={HEALTH_VARIANT[health]}>{HEALTH_LABEL[health]}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {q.isLoading
            ? 'Carregando status financeiro...'
            : days == null
            ? 'Sem ciclo de cobrança ativo.'
            : days === 0
            ? 'Seu ciclo vence hoje.'
            : `Faltam ${days} dia${days === 1 ? '' : 's'} para o vencimento.`}
        </p>
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link to="/sponsor-panel/faturamento">
            Abrir faturamento <ArrowRight className="ml-2 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default SponsorBillingCard;
