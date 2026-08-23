/**
 * Conversões de contato por rota e categoria (dados de `contact_clicks`),
 * segmentadas por tipo de profissional (autônomo x empresa).
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AsyncBoundary, SkeletonTable } from '@/components/motion';

interface Row {
  page_path: string;
  category_slug: string;
  provider_kind: string;
  whatsapp_clicks: number;
  phone_clicks: number;
  profile_clicks: number;
  total_clicks: number;
}

const KIND_LABEL: Record<string, string> = {
  company: 'Empresa/Agência',
  individual: 'Autônomo',
};

const WINDOWS = [7, 30, 90] as const;

interface Props {
  providerId: string;
}

const ContactConversionReport = ({ providerId }: Props) => {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contact-conversion-report', providerId, days],
    enabled: !!providerId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Row[]> => {
      const { data: rows, error: err } = await supabase.rpc(
        'get_contact_conversion_report' as never,
        { _days: days, _provider_id: providerId } as never,
      );
      if (err) throw err;
      return ((rows as unknown as Row[]) || []).map((r) => ({
        ...r,
        whatsapp_clicks: Number(r.whatsapp_clicks) || 0,
        phone_clicks: Number(r.phone_clicks) || 0,
        profile_clicks: Number(r.profile_clicks) || 0,
        total_clicks: Number(r.total_clicks) || 0,
      }));
    },
  });

  const totals = useMemo(() => {
    const rows = data || [];
    return rows.reduce(
      (acc, r) => ({
        whatsapp: acc.whatsapp + r.whatsapp_clicks,
        phone: acc.phone + r.phone_clicks,
        profile: acc.profile + r.profile_clicks,
        total: acc.total + r.total_clicks,
      }),
      { whatsapp: 0, phone: 0, profile: 0, total: 0 },
    );
  }, [data]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="h-4 w-4 text-accent" aria-hidden />
        <h3 className="text-sm font-bold text-foreground">Conversões por rota e categoria</h3>
        <div className="ml-auto w-32">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger aria-label="Janela de dias">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w} value={String(w)}>{`${w} dias`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <AsyncBoundary
        loading={isLoading}
        error={error}
        skeleton={<SkeletonTable rows={4} />}
        onRetry={() => void refetch()}
        empty={(data?.length ?? 0) === 0}
        emptyTitle="Sem cliques de contato"
        emptyDescription="Ainda não há cliques de contato registrados nesta janela."
      >
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">WhatsApp: {totals.whatsapp}</Badge>
          <Badge variant="outline">Ligação: {totals.phone}</Badge>
          <Badge variant="outline">Perfil: {totals.profile}</Badge>
          <Badge variant="secondary">Total: {totals.total}</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Rota</th>
                <th className="py-2 text-left">Categoria</th>
                <th className="py-2 text-left">Tipo</th>
                <th className="py-2 text-right">Zap</th>
                <th className="py-2 text-right">Ligação</th>
                <th className="py-2 text-right">Perfil</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="motion-stagger">
              {(data || []).slice(0, 25).map((r, i) => (
                <tr key={`${r.page_path}-${r.category_slug}-${i}`} className="border-t border-border">
                  <td className="max-w-[14rem] truncate py-2">{r.page_path}</td>
                  <td className="py-2">{r.category_slug}</td>
                  <td className="py-2">{KIND_LABEL[r.provider_kind] ?? r.provider_kind}</td>
                  <td className="py-2 text-right">{r.whatsapp_clicks}</td>
                  <td className="py-2 text-right">{r.phone_clicks}</td>
                  <td className="py-2 text-right">{r.profile_clicks}</td>
                  <td className="py-2 text-right font-medium">{r.total_clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncBoundary>
    </section>
  );
};

export default ContactConversionReport;
