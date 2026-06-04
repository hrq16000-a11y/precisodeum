import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, CreditCard, Receipt, AlertTriangle, CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';

// Sem arquivo de tipos novo — único consumer. Reaproveita Row do schema gerado.
type SponsorSubscriptionRow = Database['public']['Tables']['sponsor_subscriptions']['Row'];

type Plan = {
  id: string;
  name: string;
  slug: string;
  price_monthly: number | null;
  max_slots: number | null;
  max_impressions: number | null;
  features: Json | null;
  display_order: number | null;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  external_reference: string | null;
  receipt_url: string | null;
  notes: string | null;
};

type UsageResponse = {
  subscription: SponsorSubscriptionRow | null;
  usage: { active_campaigns: number; impressions_this_month: number };
  limits: { max_slots: number; max_impressions: number };
};


const formatBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n ?? 0));

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const SponsorSubscriptionPage = () => {
  const navigate = useNavigate();
  const { sponsor, subscription, loading: authLoading, refetch } = useSponsorAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !sponsor) return;
    void loadData();
  }, [authLoading, sponsor?.id]);

  async function loadData() {
    if (!sponsor) return;
    setLoading(true);
    try {
      const [plansRes, paymentsRes, usageRes] = await Promise.all([
        supabase.from('sponsor_plans').select('*').eq('active', true).order('display_order'),
        supabase
          .from('sponsor_payments' as any)
          .select('*')
          .eq('sponsor_id', sponsor.id)
          .order('paid_at', { ascending: false, nullsFirst: false })
          .limit(50),
        supabase.rpc('get_sponsor_usage' as any, { _sponsor_id: sponsor.id }),
      ]);
      setPlans((plansRes.data ?? []) as Plan[]);
      setPayments((paymentsRes.data ?? []) as unknown as Payment[]);
      setUsage((usageRes.data ?? null) as unknown as UsageResponse);
    } catch (e: any) {
      toast.error('Erro ao carregar dados', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  const currentPlan = useMemo(() => {
    if (!subscription?.plan_id) return null;
    return plans.find((p) => p.id === subscription.plan_id) ?? null;
  }, [plans, subscription]);

  async function requestPlanChange(targetPlan: Plan) {
    if (!subscription) {
      toast.info('Você ainda não tem uma assinatura ativa.', {
        description: 'Solicite a contratação pelo formulário de patrocínio.',
      });
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('sponsor_subscriptions')
        .update({
          pending_plan_id: targetPlan.id,
          pending_change_at: subscription.current_period_end ?? new Date().toISOString(),
          cancel_at_period_end: false,
        })
        .eq('id', subscription.id);
      if (error) throw error;
      toast.success('Mudança de plano agendada', {
        description: `Será efetivada em ${formatDate(subscription.current_period_end ?? null)}.`,
      });
      await refetch();
    } catch (e: any) {
      toast.error('Não foi possível agendar a mudança', { description: e?.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelAtPeriodEnd() {
    if (!subscription) return;
    if (!window.confirm('Cancelar a renovação automática ao fim do ciclo atual?')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('sponsor_subscriptions')
        .update({ cancel_at_period_end: true, pending_plan_id: null })
        .eq('id', subscription.id);
      if (error) throw error;
      toast.success('Renovação cancelada', {
        description: `Sua assinatura ficará ativa até ${formatDate(subscription.current_period_end ?? null)}.`,
      });
      await refetch();
    } catch (e: any) {
      toast.error('Erro ao cancelar', { description: e?.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function reactivate() {
    if (!subscription) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('sponsor_subscriptions')
        .update({ cancel_at_period_end: false })
        .eq('id', subscription.id);
      if (error) throw error;
      toast.success('Renovação reativada');
      await refetch();
    } catch (e: any) {
      toast.error('Erro ao reativar', { description: e?.message });
    } finally {
      setActionLoading(false);
    }
  }

  const usagePercent = (used: number, limit: number) => {
    if (!limit || limit < 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  const slotsUsed = usage?.usage.active_campaigns ?? 0;
  const slotsLimit = usage?.limits.max_slots ?? 0;
  const impressionsUsed = usage?.usage.impressions_this_month ?? 0;
  const impressionsLimit = usage?.limits.max_impressions ?? 0;

  const slotsPct = usagePercent(slotsUsed, slotsLimit);
  const impressionsPct = impressionsLimit === -1 ? 0 : usagePercent(impressionsUsed, impressionsLimit);

  const slotsBarVariant = slotsPct >= 100 ? 'destructive' : slotsPct >= 80 ? 'warning' : 'default';

  return (
    <SponsorLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Assinatura e Pagamentos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seu plano, acompanhe limites e veja o histórico de pagamentos.
          </p>
        </header>

        {/* Plano atual */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Plano atual
                </CardTitle>
                <CardDescription>Detalhes da sua assinatura ativa.</CardDescription>
              </div>
              {subscription?.cancel_at_period_end && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> Cancelamento agendado
                </Badge>
              )}
              {(subscription as any)?.pending_plan_id && (
                <Badge variant="secondary">Mudança de plano agendada</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {authLoading || loading ? (
              <Skeleton className="h-24 w-full" />
            ) : subscription && currentPlan ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Plano</p>
                  <p className="text-lg font-semibold text-foreground">{currentPlan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBRL(currentPlan.price_monthly)}/mês
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Período atual</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ciclo {subscription.billing_cycle}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                    {subscription.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Sem assinatura ativa</AlertTitle>
                <AlertDescription>
                  Você ainda não tem um plano ativo. Escolha um abaixo e nossa equipe entrará em contato.
                </AlertDescription>
              </Alert>
            )}

            {subscription && (
              <div className="mt-4 flex flex-wrap gap-2">
                {subscription.cancel_at_period_end ? (
                  <Button onClick={reactivate} disabled={actionLoading} variant="default">
                    Reativar renovação
                  </Button>
                ) : (
                  <Button onClick={cancelAtPeriodEnd} disabled={actionLoading} variant="outline">
                    Cancelar renovação
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medidores de uso */}
        <Card>
          <CardHeader>
            <CardTitle>Uso do plano</CardTitle>
            <CardDescription>Atualizado em tempo real.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Campanhas ativas</span>
                <span className="text-muted-foreground">
                  {slotsUsed} {slotsLimit === -1 ? '/ ilimitado' : `/ ${slotsLimit}`}
                </span>
              </div>
              <Progress value={slotsLimit === -1 ? 0 : slotsPct} />
              {slotsPct >= 100 && slotsLimit !== -1 && (
                <p className="mt-1 text-xs text-destructive">
                  Limite atingido. Faça upgrade para criar mais campanhas.
                </p>
              )}
              {slotsPct >= 80 && slotsPct < 100 && (
                <p className="mt-1 text-xs text-yellow-600">Você está perto do limite.</p>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Impressões no mês</span>
                <span className="text-muted-foreground">
                  {impressionsUsed.toLocaleString('pt-BR')}{' '}
                  {impressionsLimit === -1 ? '/ ilimitado' : `/ ${impressionsLimit.toLocaleString('pt-BR')}`}
                </span>
              </div>
              <Progress value={impressionsLimit === -1 ? 0 : impressionsPct} />
            </div>
          </CardContent>
        </Card>

        {/* Trocar plano */}
        <Card>
          <CardHeader>
            <CardTitle>Trocar de plano</CardTitle>
            <CardDescription>
              A mudança é agendada para o início do próximo ciclo de cobrança.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {plans.map((p) => {
                  const isCurrent = currentPlan?.id === p.id;
                  const isUpgrade =
                    currentPlan && (p.price_monthly ?? 0) > (currentPlan.price_monthly ?? 0);
                  return (
                    <div
                      key={p.id}
                      className={`relative rounded-lg border p-4 transition ${
                        isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'
                      }`}
                    >
                      {isCurrent && (
                        <Badge className="absolute right-2 top-2" variant="default">
                          Atual
                        </Badge>
                      )}
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        {formatBRL(p.price_monthly)}
                        <span className="text-sm font-normal text-muted-foreground">/mês</span>
                      </p>
                      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                        <li>
                          {p.max_slots === -1 ? 'Banners ilimitados' : `${p.max_slots} banner(s)`}
                        </li>
                        <li>
                          {p.max_impressions === -1
                            ? 'Impressões ilimitadas'
                            : `${(p.max_impressions ?? 0).toLocaleString('pt-BR')} impressões/mês`}
                        </li>
                      </ul>
                      <Button
                        className="mt-4 w-full"
                        size="sm"
                        variant={isCurrent ? 'outline' : 'default'}
                        disabled={isCurrent || actionLoading || !subscription}
                        onClick={() => requestPlanChange(p)}
                      >
                        {isCurrent ? (
                          <>
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Plano atual
                          </>
                        ) : isUpgrade ? (
                          <>
                            <ArrowUpRight className="mr-1 h-4 w-4" /> Fazer upgrade
                          </>
                        ) : (
                          <>
                            <ArrowDownRight className="mr-1 h-4 w-4" /> Fazer downgrade
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Histórico de pagamentos
            </CardTitle>
            <CardDescription>Pagamentos registrados pela equipe administrativa.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Período</th>
                      <th className="py-2 pr-3">Método</th>
                      <th className="py-2 pr-3">Valor</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Recibo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-foreground">{formatDate(pay.paid_at)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {pay.period_start ? `${formatDate(pay.period_start)} – ${formatDate(pay.period_end)}` : '—'}
                        </td>
                        <td className="py-2 pr-3 capitalize text-foreground">{pay.payment_method}</td>
                        <td className="py-2 pr-3 font-medium text-foreground">{formatBRL(pay.amount)}</td>
                        <td className="py-2 pr-3">
                          <Badge
                            variant={
                              pay.status === 'paid'
                                ? 'default'
                                : pay.status === 'refunded'
                                  ? 'secondary'
                                  : pay.status === 'failed'
                                    ? 'destructive'
                                    : 'outline'
                            }
                          >
                            {pay.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          {pay.receipt_url ? (
                            <a
                              href={pay.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              Abrir <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SponsorLayout>
  );
};

export default SponsorSubscriptionPage;
