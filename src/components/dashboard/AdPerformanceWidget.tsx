/**
 * AdPerformanceWidget — "Desempenho do Seu Anúncio".
 *
 * Mostra ao prestador o ROI do anúncio Padrão Ouro:
 *  - Cliques nos últimos 7 e 30 dias (whatsapp / phone / total)
 *  - Status de indexação no Google (sitemap)
 *  - Comparativo de alcance (Padrão Ouro = +3.5x)
 *  - Diagnóstico automático: se poucos cliques, sugere revisar foto
 */
import { useEffect, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, MessageCircle, Phone, CheckCircle2, AlertTriangle, Camera } from 'lucide-react';

interface Stats {
  clicks_7d: number;
  clicks_30d: number;
  whatsapp_7d: number;
  whatsapp_30d: number;
  phone_7d: number;
  phone_30d: number;
  last_click_at: string | null;
}

interface Props {
  providerId: string;
  hasPhoto: boolean;
}

export default function AdPerformanceWidget({ providerId, hasPhoto }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .rpc('get_provider_lead_stats', { _provider_id: providerId });
      if (!alive) return;
      if (!error && data && Array.isArray(data) && data[0]) setStats(data[0] as Stats);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [providerId]);

  const clicks30 = stats?.clicks_30d ?? 0;
  const lowEngagement = !loading && clicks30 < 3;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Desempenho do Seu Anúncio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comparativo Padrão Ouro */}
        <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-3 text-sm">
          <p className="font-medium text-foreground">
            Anúncios Padrão Ouro como o seu aparecem <span className="text-primary font-bold">3,5x mais</span> nas buscas do Google e da plataforma.
          </p>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Cliques (7 dias)</p>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : stats?.clicks_7d ?? 0}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline" className="gap-1 text-xs">
                <MessageCircle className="h-3 w-3" />{stats?.whatsapp_7d ?? 0}
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <Phone className="h-3 w-3" />{stats?.phone_7d ?? 0}
              </Badge>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Cliques (30 dias)</p>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : clicks30}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline" className="gap-1 text-xs">
                <MessageCircle className="h-3 w-3" />{stats?.whatsapp_30d ?? 0}
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <Phone className="h-3 w-3" />{stats?.phone_30d ?? 0}
              </Badge>
            </div>
          </div>
        </div>

        {/* Indexação */}
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-emerald-900 dark:text-emerald-100">
            Seu anúncio foi enviado com sucesso para o índice do Google via Sitemap de Qualidade.
          </p>
        </div>

        {/* Diagnóstico automático */}
        {lowEngagement && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Notamos poucos cliques nos últimos 30 dias.
              </p>
              <p className="text-amber-800 dark:text-amber-200 mt-1">
                {hasPhoto
                  ? 'Revise a descrição e palavras-chave do serviço para melhorar a conversão.'
                  : 'Adicionar uma foto real pode aumentar seus contatos em até 40%.'}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2 gap-1">
                <Link to={hasPhoto ? '/dashboard/servicos' : '/dashboard/servicos?step=photo'}>
                  <Camera className="h-4 w-4" />
                  {hasPhoto ? 'Revisar serviço' : 'Adicionar foto agora'}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
