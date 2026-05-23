import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

const STATUS_VARIANT: Record<string, 'default'|'secondary'|'outline'|'destructive'> = {
  issued: 'outline', paid: 'secondary', void: 'destructive', refunded: 'default',
};

export default function AdminRecentInvoicesCard({ limit = 20 }: { limit?: number }) {
  const q = useQuery({
    queryKey: ['admin-recent-invoices', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsor_invoices' as any)
        .select('id,invoice_number,sponsor_id,issued_at,total_amount,status,notes,change_request_id,billing_cycle_id, sponsors:sponsors(id,title,company_name)')
        .order('issued_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" /> Faturas e recibos recentes
        </CardTitle>
        <CardDescription>
          Recibos emitidos automaticamente após aprovações e cobranças geradas a partir de ciclos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : q.data && q.data.length > 0 ? (
          <ul className="divide-y">
            {q.data.map((inv: any) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">#{inv.invoice_number}</span>
                    {' · '}
                    <span className="text-muted-foreground">
                      {inv.sponsors?.title || inv.sponsors?.company_name || inv.sponsor_id?.slice(0, 8)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {fmtDate(inv.issued_at)} · {inv.notes || (inv.change_request_id ? 'Recibo de aprovação' : 'Ciclo de cobrança')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span>{fmtMoney(Number(inv.total_amount || 0))}</span>
                  <Badge variant={STATUS_VARIANT[inv.status] || 'outline'}>{inv.status}</Badge>
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
