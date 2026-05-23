import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, RefreshCcw, Receipt, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import {
  HEALTH_LABEL,
  HEALTH_VARIANT,
  STATUS_LABEL,
  type BillingStatusPayload,
  type BillingCycleStatus,
} from '@/lib/sponsorBilling';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SponsorInvoicesCard from '@/components/sponsors/SponsorInvoicesCard';

const SponsorBillingPage = () => {
  const { sponsor, loading: authLoading } = useSponsorAuth();
  const [requesting, setRequesting] = useState(false);

  const q = useQuery({
    queryKey: ['sponsor-billing-status', sponsor?.id],
    enabled: !!sponsor?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sponsor_billing_status' as any, {
        _sponsor_id: sponsor!.id,
      });
      if (error) throw error;
      return data as unknown as BillingStatusPayload;
    },
  });

  const payload = q.data;
  const cycle = payload?.current_cycle;

  const handleRenew = async () => {
    if (!sponsor?.id) return;
    setRequesting(true);
    try {
      const { error } = await supabase.rpc('sponsor_request_renewal' as any, {
        _sponsor_id: sponsor.id,
      });
      if (error) throw error;
      toast.success('Solicitação de renovação enviada. Nosso time vai entrar em contato.');
      q.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível solicitar renovação agora.');
    } finally {
      setRequesting(false);
    }
  };

  const formatDate = (d?: string | null) =>
    d ? format(parseISO(d), "dd 'de' MMM yyyy", { locale: ptBR }) : '—';

  if (authLoading || q.isLoading) {
    return (
      <SponsorLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </SponsorLayout>
    );
  }

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturamento e renovação</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status da sua campanha, vencimentos e solicite renovação.
          </p>
        </div>

        {/* Card de status atual */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Ciclo atual
              </CardTitle>
              <CardDescription>
                {payload?.subscription
                  ? `Plano ${payload.subscription.billing_cycle === 'yearly' ? 'anual' : 'mensal'}`
                  : 'Sem plano ativo associado'}
              </CardDescription>
            </div>
            <Badge variant={HEALTH_VARIANT[payload?.health || 'healthy']}>
              {HEALTH_LABEL[payload?.health || 'healthy']}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Vencimento" value={formatDate(cycle?.cycle_end)} />
              <Field
                label="Dias restantes"
                value={payload?.days_left != null ? `${payload.days_left} dias` : '—'}
              />
              <Field
                label="Valor"
                value={cycle?.amount != null
                  ? cycle.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '—'}
              />
              <Field label="Status do ciclo" value={cycle ? STATUS_LABEL[cycle.status] : '—'} />
              <Field
                label="Método pagamento"
                value={cycle?.payment_method || 'A combinar'}
              />
              <Field
                label="Tolerância (grace) até"
                value={formatDate(cycle?.grace_until)}
              />
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium text-foreground">Instruções de pagamento</p>
              <p className="mt-1 text-muted-foreground">
                O pagamento ainda é processado de forma manual via Pix ou transferência. Após solicitar
                renovação, nosso time financeiro envia o comprovante de cobrança no seu e-mail cadastrado.
                Quando o pagamento for confirmado pelo admin, o status muda automaticamente para "Pago".
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleRenew}
                disabled={requesting || !sponsor?.id || cycle?.renewal_requested}
              >
                {requesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                {cycle?.renewal_requested ? 'Renovação já solicitada' : 'Solicitar renovação'}
              </Button>
              {cycle?.renewal_requested && cycle.renewal_requested_at && (
                <span className="text-xs text-muted-foreground">
                  Solicitado em {formatDate(cycle.renewal_requested_at)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Histórico de ciclos
            </CardTitle>
            <CardDescription>Últimos 12 ciclos de cobrança.</CardDescription>
          </CardHeader>
          <CardContent>
            {payload?.history?.length ? (
              <div className="space-y-2">
                {payload.history.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {formatDate(c.cycle_start)} → {formatDate(c.cycle_end)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.invoice_reference ? `Ref: ${c.invoice_reference}` : 'Sem referência'}
                        {c.paid_at ? ` · Pago em ${formatDate(c.paid_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.amount != null && (
                        <span className="text-sm">
                          {c.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      )}
                      <Badge variant={cycleBadgeVariant(c.status)}>{STATUS_LABEL[c.status]}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum ciclo registrado ainda.</p>
            )}
          </CardContent>
        </Card>

        <SponsorInvoicesCard sponsorId={sponsor?.id} />
      </div>
    </SponsorLayout>
  );
};


function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function cycleBadgeVariant(status: BillingCycleStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'paid') return 'secondary';
  if (status === 'expired' || status === 'cancelled' || status === 'overdue') return 'destructive';
  if (status === 'grace') return 'default';
  return 'outline';
}

export default SponsorBillingPage;
