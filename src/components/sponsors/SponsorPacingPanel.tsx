import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, MinusCircle, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeliveryRow {
  sponsor_id: string;
  title: string | null;
  company_name: string | null;
  plan: string | null;
  delivered_today: number;
  delivered_total: number;
  guaranteed_impressions: number | null;
  days_remaining: number | null;
  target_today: number | null;
  pacing_percentage: number | null;
  pacing_status: 'healthy' | 'warning' | 'critical' | 'no_target' | 'unknown';
  ctr: number;
  active_slots: number;
  last_delivery_check_at: string | null;
}

const STATUS_META: Record<DeliveryRow['pacing_status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
  healthy:   { label: 'Saudável',   variant: 'default',     icon: CheckCircle2 },
  warning:   { label: 'Atrasado',   variant: 'secondary',   icon: Activity },
  critical:  { label: 'Crítico',    variant: 'destructive', icon: AlertTriangle },
  no_target: { label: 'Sem meta',   variant: 'outline',     icon: MinusCircle },
  unknown:   { label: 'N/D',        variant: 'outline',     icon: MinusCircle },
};

/**
 * Painel operacional de pacing — exibe entrega de hoje vs. meta diária por patrocinador.
 * Sponsor Delivery & Pacing (Fase 1.2).
 */
export default function SponsorPacingPanel() {
  const { data: rows = [], isLoading, error, refetch } = useQuery({
    queryKey: ['sponsor-delivery-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sponsor_delivery_status', {
        _only_active: true,
      } as any);
      if (error) throw error;
      return (data || []) as DeliveryRow[];
    },
    staleTime: 1000 * 60,
  });

  const counts = rows.reduce(
    (acc, r) => {
      acc[r.pacing_status] = (acc[r.pacing_status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['critical', 'warning', 'healthy', 'no_target'] as const).map((k) => {
          const meta = STATUS_META[k];
          const Icon = meta.icon;
          return (
            <Card key={k}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" /> {meta.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{counts[k] || 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Entrega operacional (hoje)</CardTitle>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Atualizar
          </button>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {error && <p className="text-sm text-destructive">Falha ao carregar pacing.</p>}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patrocinador</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Hoje</TableHead>
                  <TableHead className="text-right">Meta/dia</TableHead>
                  <TableHead className="text-right">Pacing</TableHead>
                  <TableHead className="text-right">Dias restantes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última verificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum patrocinador ativo.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const meta = STATUS_META[r.pacing_status] ?? STATUS_META.unknown;
                    return (
                      <TableRow key={r.sponsor_id}>
                        <TableCell className="font-medium">
                          {r.company_name || r.title || r.sponsor_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">{r.plan || '—'}</TableCell>
                        <TableCell className="text-right">{r.delivered_today.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right">
                          {r.target_today === null ? '—' : Math.round(Number(r.target_today)).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.pacing_percentage === null ? '—' : `${Number(r.pacing_percentage).toFixed(0)}%`}
                        </TableCell>
                        <TableCell className="text-right">{r.days_remaining ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.last_delivery_check_at
                            ? formatDistanceToNow(new Date(r.last_delivery_check_at), { addSuffix: true, locale: ptBR })
                            : 'nunca'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Status recalculado diariamente às 02:30. Critérios: saudável ≥90%, atrasado 70–89%, crítico &lt;70%.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
