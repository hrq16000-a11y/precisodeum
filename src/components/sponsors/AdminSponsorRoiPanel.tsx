import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminRoiPayload {
  window_days: number;
  top_sponsors: Array<{
    sponsor_id: string;
    name: string | null;
    impressions: number;
    clicks: number;
    profile_views: number;
    lead_submits: number;
    ctr: number;
    conv_view_lead: number;
  }>;
  top_slots: Array<{ slot: string; impressions: number; clicks: number; ctr: number }>;
  top_cities: Array<{ city: string; views: number; leads: number }>;
}

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString('pt-BR');

/**
 * Fase 2.3 — Visão admin de ROI sponsor.
 * Ranking de sponsors, slots e cidades por conversão atribuída.
 */
export default function AdminSponsorRoiPanel({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-sponsor-roi', days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_sponsor_roi' as any, { _days: days } as any);
      if (error) throw error;
      return data as unknown as AdminRoiPayload;
    },
    staleTime: 1000 * 60,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top sponsors por conversão ({data.window_days}d)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patrocinador</TableHead>
                <TableHead className="text-right">Imp.</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Perfis</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Perfil→Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.top_sponsors.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Sem dados na janela.</TableCell></TableRow>
              ) : data.top_sponsors.map((s) => (
                <TableRow key={s.sponsor_id}>
                  <TableCell className="font-medium">{s.name || s.sponsor_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-right">{fmt(s.impressions)}</TableCell>
                  <TableCell className="text-right">{fmt(s.clicks)}</TableCell>
                  <TableCell className="text-right">{Number(s.ctr || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{fmt(s.profile_views)}</TableCell>
                  <TableCell className="text-right">{fmt(s.lead_submits)}</TableCell>
                  <TableCell className="text-right">{Number(s.conv_view_lead || 0).toFixed(2)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Slots por performance</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Slot</TableHead><TableHead className="text-right">Imp.</TableHead><TableHead className="text-right">Cliques</TableHead><TableHead className="text-right">CTR</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.top_slots.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-sm">Sem dados.</TableCell></TableRow>
                ) : data.top_slots.map((s) => (
                  <TableRow key={s.slot}>
                    <TableCell className="capitalize">{s.slot}</TableCell>
                    <TableCell className="text-right">{fmt(s.impressions)}</TableCell>
                    <TableCell className="text-right">{fmt(s.clicks)}</TableCell>
                    <TableCell className="text-right">{Number(s.ctr || 0).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cidades que mais convertem</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Cidade</TableHead><TableHead className="text-right">Perfis</TableHead><TableHead className="text-right">Leads</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.top_cities.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">Sem atribuição ainda.</TableCell></TableRow>
                ) : data.top_cities.map((c) => (
                  <TableRow key={c.city}>
                    <TableCell className="capitalize">{c.city}</TableCell>
                    <TableCell className="text-right">{fmt(c.views)}</TableCell>
                    <TableCell className="text-right">{fmt(c.leads)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
