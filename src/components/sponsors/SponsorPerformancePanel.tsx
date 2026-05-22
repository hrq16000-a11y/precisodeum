import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, MousePointerClick, TrendingUp } from 'lucide-react';

interface PerformanceRow {
  sponsor_id: string;
  slot_slug: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface SponsorMini {
  id: string;
  title: string | null;
  company_name: string | null;
}

interface Props {
  /** Filtrar por sponsor específico (omitir para visão admin global). */
  sponsorId?: string;
  /** Janela em dias (default 30). */
  days?: number;
}

/**
 * Painel mínimo de performance — chama a RPC `get_sponsor_performance`
 * e exibe impressões, cliques e CTR agregados por sponsor/slot.
 *
 * Sponsor Tracking Foundation (Fase 1.1).
 */
export default function SponsorPerformancePanel({ sponsorId, days = 30 }: Props) {
  const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['sponsor-performance', sponsorId ?? 'all', from],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sponsor_performance', {
        _sponsor_id: sponsorId ?? null,
        _from: from,
        _to: null,
      } as any);
      if (error) throw error;
      return (data || []) as PerformanceRow[];
    },
    staleTime: 1000 * 60,
  });

  const sponsorIds = Array.from(new Set(rows.map((r) => r.sponsor_id)));
  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors-mini', sponsorIds],
    enabled: sponsorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('sponsors')
        .select('id, title, company_name')
        .in('id', sponsorIds);
      return (data || []) as SponsorMini[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const nameById = new Map(sponsors.map((s) => [s.id, s.company_name || s.title || s.id]));

  const totals = rows.reduce(
    (acc, r) => {
      acc.impressions += Number(r.impressions || 0);
      acc.clicks += Number(r.clicks || 0);
      return acc;
    },
    { impressions: 0, clicks: 0 },
  );
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Eye className="h-4 w-4" /> Impressões ({days}d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.impressions.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <MousePointerClick className="h-4 w-4" /> Cliques ({days}d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.clicks.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> CTR médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ctr.toFixed(2)}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por patrocinador e slot</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {error && <p className="text-sm text-destructive">Falha ao carregar performance.</p>}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patrocinador</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum evento registrado nos últimos {days} dias.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={`${r.sponsor_id}-${r.slot_slug}`}>
                      <TableCell className="font-medium">{nameById.get(r.sponsor_id) || r.sponsor_id.slice(0, 8)}</TableCell>
                      <TableCell>{r.slot_slug}</TableCell>
                      <TableCell className="text-right">{Number(r.impressions).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{Number(r.clicks).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{Number(r.ctr).toFixed(2)}%</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
