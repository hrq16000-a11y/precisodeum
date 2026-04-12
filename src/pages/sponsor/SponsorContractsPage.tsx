import SponsorLayout from '@/components/sponsor/SponsorLayout';
import { useSponsorAuth } from '@/hooks/useSponsorAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { FileText, Calendar, DollarSign, Download, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; icon: any; variant: any }> = {
  draft: { label: 'Rascunho', icon: Clock, variant: 'secondary' },
  active: { label: 'Ativo', icon: CheckCircle2, variant: 'default' },
  expired: { label: 'Expirado', icon: XCircle, variant: 'destructive' },
  cancelled: { label: 'Cancelado', icon: XCircle, variant: 'secondary' },
};

const SponsorContractsPage = () => {
  const { sponsor, loading } = useSponsorAuth();

  const { data: contracts = [], isLoading } = useQuery({
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
        <div className="space-y-4">
          <div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
          </div>
        </div>
      </SponsorLayout>
    );
  }

  const activeContracts = contracts.filter((c: any) => c.status === 'active');
  const totalValue = contracts.reduce((s: number, c: any) => s + (Number(c.value) || 0), 0);

  return (
    <SponsorLayout>
      <div className="space-y-6">
        <motion.h1
          className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Contratos
        </motion.h1>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{contracts.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="text-xl font-bold">{activeContracts.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contract cards */}
        {contracts.length > 0 ? (
          <div className="space-y-4">
            {contracts.map((c: any, i: number) => {
              const st = statusConfig[c.status] || statusConfig.draft;
              const Icon = st.icon;
              const daysLeft = c.end_date ? differenceInDays(parseISO(c.end_date), new Date()) : null;
              const totalDays = c.start_date && c.end_date
                ? differenceInDays(parseISO(c.end_date), parseISO(c.start_date))
                : null;
              const elapsed = c.start_date ? differenceInDays(new Date(), parseISO(c.start_date)) : null;
              const progressPct = totalDays && totalDays > 0 ? Math.min((elapsed! / totalDays) * 100, 100) : 0;

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {c.contract_number || 'Contrato sem número'}
                        </CardTitle>
                        <Badge variant={st.variant} className="gap-1">
                          <Icon className="w-3 h-3" /> {st.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>
                            {c.start_date ? format(parseISO(c.start_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'} →{' '}
                            {c.end_date ? format(parseISO(c.end_date), 'dd/MM/yyyy', { locale: ptBR }) : '∞'}
                          </span>
                        </div>
                        {c.value > 0 && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="w-4 h-4 shrink-0" />
                            <span>R$ {Number(c.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {daysLeft !== null && c.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <Badge variant={daysLeft <= 7 ? 'destructive' : 'outline'} className="text-xs">
                              {daysLeft > 0 ? `${daysLeft} dias restantes` : 'Expirado'}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Progress bar for active contracts */}
                      {c.status === 'active' && totalDays && totalDays > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progresso do contrato</span>
                            <span>{progressPct.toFixed(0)}%</span>
                          </div>
                          <Progress value={progressPct} className="h-1.5" />
                        </div>
                      )}

                      {c.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{c.notes}</p>}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">Nenhum contrato registrado.</p>
              <p className="text-xs text-muted-foreground mt-1">Os contratos são gerenciados pela equipe administrativa.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </SponsorLayout>
  );
};

export default SponsorContractsPage;
