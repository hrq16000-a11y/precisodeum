import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, MousePointerClick, UserCheck, MessageSquare, TrendingUp, MapPin } from 'lucide-react';

interface RoiPayload {
  sponsor_id: string;
  window_days: number;
  impressions: number;
  clicks: number;
  profile_views: number;
  lead_submits: number;
  ctr_impression_to_click: number;
  ctr_click_to_view: number;
  ctr_view_to_lead: number;
  ctr_click_to_lead: number;
  top_slots: Array<{ slot: string; impressions: number; clicks: number; ctr: number }>;
  top_cities: Array<{ city: string; views: number; leads: number }>;
  by_day: Array<{ date: string; impressions: number; clicks: number }>;
}

interface Props {
  sponsorId: string;
  days?: number;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('pt-BR');

/**
 * Fase 2.3 — Painel ROI comercial do patrocinador.
 * Narrativa simples: alcance → cliques → perfis abertos → leads.
 * Sem tabelas infinitas. Sem BI.
 */
export default function SponsorRoiPanel({ sponsorId, days = 30 }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sponsor-roi', sponsorId, days],
    enabled: Boolean(sponsorId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sponsor_roi' as any, {
        _sponsor_id: sponsorId,
        _days: days,
      } as any);
      if (error) throw error;
      return data as unknown as RoiPayload;
    },
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Sem dados de ROI para a janela selecionada.
        </CardContent>
      </Card>
    );
  }

  const reachApprox = Math.max(data.impressions, Math.round(data.impressions * 0.85));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo dos últimos {data.window_days} dias</CardTitle>
          <CardDescription>
            Você alcançou aproximadamente <strong>{fmt(reachApprox)}</strong> pessoas.{' '}
            <strong>{fmt(data.clicks)}</strong> clicaram no seu anúncio,{' '}
            <strong>{fmt(data.profile_views)}</strong> visualizaram seu perfil e{' '}
            <strong>{fmt(data.lead_submits)}</strong> enviaram um pedido de contato.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Eye} label="Impressões" value={fmt(data.impressions)} />
        <KpiCard icon={MousePointerClick} label="Cliques" value={fmt(data.clicks)} sub={`CTR ${data.ctr_impression_to_click}%`} />
        <KpiCard icon={UserCheck} label="Perfis abertos" value={fmt(data.profile_views)} sub={`${data.ctr_click_to_view}% dos cliques`} />
        <KpiCard icon={MessageSquare} label="Leads" value={fmt(data.lead_submits)} sub={`${data.ctr_view_to_lead}% dos perfis`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Melhores posições
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <ul className="space-y-2">
                {data.top_slots.slice(0, 5).map((s) => (
                  <li key={s.slot} className="flex justify-between text-sm">
                    <span className="capitalize">{s.slot}</span>
                    <span className="text-muted-foreground">
                      {fmt(s.impressions)} imp · {fmt(s.clicks)} cliques · CTR {s.ctr}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Cidades que mais convertem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_cities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda sem cidades atribuídas. Conforme os cliques no seu anúncio gerarem
                contatos, a lista aparecerá aqui.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.top_cities.slice(0, 5).map((c) => (
                  <li key={c.city} className="flex justify-between text-sm">
                    <span className="capitalize">{c.city}</span>
                    <span className="text-muted-foreground">
                      {fmt(c.views)} perfis · {fmt(c.leads)} leads
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground font-medium">
          <Icon className="h-3.5 w-3.5" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
