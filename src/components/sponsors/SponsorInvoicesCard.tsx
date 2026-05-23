import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Props { sponsorId: string | null | undefined; limit?: number }

export interface SponsorInvoice {
  id: string;
  invoice_number: number;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  total_amount: number;
  currency: string;
  status: 'issued' | 'paid' | 'void' | 'refunded';
  items: any[];
  pdf_url: string | null;
  notes: string | null;
}

const STATUS_LABEL: Record<SponsorInvoice['status'], string> = {
  issued: 'Emitida',
  paid: 'Paga',
  void: 'Cancelada',
  refunded: 'Reembolsada',
};
const STATUS_VARIANT: Record<SponsorInvoice['status'], 'default'|'secondary'|'outline'|'destructive'> = {
  issued: 'outline',
  paid: 'secondary',
  void: 'destructive',
  refunded: 'default',
};

const fmtMoney = (n: number, cur = 'BRL') =>
  (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: cur });
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SponsorInvoicesCard({ sponsorId, limit = 12 }: Props) {
  const q = useQuery({
    queryKey: ['sponsor-invoices', sponsorId, limit],
    enabled: !!sponsorId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_sponsor_invoices' as any, {
        _sponsor_id: sponsorId!,
        _limit: limit,
      });
      if (error) throw error;
      return (data || []) as unknown as SponsorInvoice[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" /> Faturas e recibos
        </CardTitle>
        <CardDescription>Histórico de cobranças e recibos emitidos automaticamente.</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : q.data && q.data.length > 0 ? (
          <ul className="divide-y">
            {q.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Fatura #{inv.invoice_number}{' '}
                    <span className="text-xs text-muted-foreground">· emitida em {fmtDate(inv.issued_at)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {inv.notes || (inv.items?.[0]?.description ?? 'Sem descrição')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium">{fmtMoney(inv.total_amount, inv.currency)}</span>
                  <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  {inv.pdf_url && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={inv.pdf_url} target="_blank" rel="noreferrer" aria-label="Baixar fatura">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma fatura emitida ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}
