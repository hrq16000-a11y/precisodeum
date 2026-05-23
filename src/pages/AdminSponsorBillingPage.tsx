import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { STATUS_LABEL, type BillingCycleRow, type BillingCycleStatus } from '@/lib/sponsorBilling';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminRecentInvoicesCard from '@/components/sponsors/AdminRecentInvoicesCard';

type Row = BillingCycleRow & {
  sponsors?: { id: string; title: string; company_name: string | null } | null;
};

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'expiring_soon', label: 'Vence em ≤7 dias' },
  { value: 'renewal_requested', label: 'Renovação solicitada' },
  { value: 'overdue', label: 'Em atraso' },
  { value: 'grace', label: 'Em tolerância' },
  { value: 'awaiting_payment', label: 'Aguardando pagamento' },
  { value: 'paid', label: 'Pagos' },
  { value: 'expired', label: 'Expirados' },
];

const AdminSponsorBillingPage = () => {
  const [filter, setFilter] = useState<string>('renewal_requested');
  const [search, setSearch] = useState('');
  const [paying, setPaying] = useState<Row | null>(null);
  const [updating, setUpdating] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  // Pay form
  const [payMethod, setPayMethod] = useState('Pix');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  // Update form
  const [newStatus, setNewStatus] = useState<BillingCycleStatus>('grace');
  const [graceUntil, setGraceUntil] = useState('');
  const [updateNote, setUpdateNote] = useState('');

  const q = useQuery({
    queryKey: ['admin-sponsor-billing', filter, search],
    queryFn: async () => {
      let qb = supabase
        .from('sponsor_billing_cycles' as any)
        .select('*, sponsors(id, title, company_name)')
        .order('cycle_end', { ascending: true })
        .limit(200);

      if (filter === 'renewal_requested') {
        qb = qb.eq('renewal_requested', true).in('status', ['pending', 'awaiting_payment', 'overdue', 'grace']);
      } else if (filter === 'expiring_soon') {
        const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        qb = qb.lte('cycle_end', in7).in('status', ['pending', 'awaiting_payment', 'paid']);
      } else if (filter !== 'all') {
        qb = qb.eq('status', filter);
      }

      const { data, error } = await qb;
      if (error) throw error;
      let rows = (data as unknown as Row[]) || [];
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            r.sponsors?.title?.toLowerCase().includes(s) ||
            r.sponsors?.company_name?.toLowerCase().includes(s) ||
            r.invoice_reference?.toLowerCase().includes(s),
        );
      }
      return rows;
    },
  });

  const counts = useMemo(() => {
    const rows = q.data || [];
    return {
      total: rows.length,
      overdue: rows.filter((r) => r.status === 'overdue').length,
      grace: rows.filter((r) => r.status === 'grace').length,
      renewal: rows.filter((r) => r.renewal_requested).length,
    };
  }, [q.data]);

  const formatDate = (d?: string | null) =>
    d ? format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }) : '—';

  const submitPay = async () => {
    if (!paying) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('admin_mark_billing_paid' as any, {
        _cycle_id: paying.id,
        _payment_method: payMethod || null,
        _invoice_reference: payRef || null,
        _admin_note: payNote || null,
      });
      if (error) throw error;
      toast.success('Pagamento confirmado.');
      setPaying(null);
      setPayRef('');
      setPayNote('');
      q.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao confirmar pagamento.');
    } finally {
      setBusy(false);
    }
  };

  const submitUpdate = async () => {
    if (!updating) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('admin_update_billing_cycle' as any, {
        _cycle_id: updating.id,
        _status: newStatus,
        _grace_until: graceUntil ? new Date(graceUntil).toISOString() : null,
        _admin_note: updateNote || null,
      });
      if (error) throw error;
      toast.success('Ciclo atualizado.');
      setUpdating(null);
      setGraceUntil('');
      setUpdateNote('');
      q.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar ciclo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturamento de patrocinadores</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline operacional de cobrança e renovação. Confirme pagamentos manuais, conceda
            tolerância (grace) ou marque ciclos como cancelados/expirados.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Visíveis" value={counts.total} />
          <KpiCard label="Em atraso" value={counts.overdue} tone="destructive" />
          <KpiCard label="Em tolerância" value={counts.grace} />
          <KpiCard label="Renovação solicitada" value={counts.renewal} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ciclos</CardTitle>
            <CardDescription>Filtre por status operacional e busque por nome ou referência.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTERS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar patrocinador ou referência..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:w-80"
              />
            </div>

            {q.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : !q.data?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum ciclo encontrado para este filtro.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patrocinador</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Renovação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-medium">{r.sponsors?.company_name || r.sponsors?.title || '—'}</p>
                          <p className="text-xs text-muted-foreground">{r.invoice_reference || 'Sem ref.'}</p>
                        </TableCell>
                        <TableCell>{formatDate(r.cycle_end)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            r.status === 'paid' ? 'secondary'
                              : r.status === 'overdue' || r.status === 'expired' || r.status === 'cancelled' ? 'destructive'
                              : r.status === 'grace' ? 'default'
                              : 'outline'
                          }>{STATUS_LABEL[r.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          {r.amount != null
                            ? r.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {r.renewal_requested ? (
                            <Badge variant="default" className="gap-1">
                              <Clock className="h-3 w-3" /> Solicitada
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => { setPaying(r); setPayMethod(r.payment_method || 'Pix'); setPayRef(r.invoice_reference || ''); }}
                            disabled={r.status === 'paid'}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Pago
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setUpdating(r); setNewStatus('grace'); }}>
                            Atualizar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AdminRecentInvoicesCard />
      </div>


      {/* Pay dialog */}
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">Método</label>
              <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Referência / nº fatura</label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Nota interna</label>
              <Textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={submitPay} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update dialog */}
      <Dialog open={!!updating} onOpenChange={(o) => !o && setUpdating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar ciclo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">Novo status</label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as BillingCycleStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['pending','awaiting_payment','overdue','grace','cancelled','expired'] as BillingCycleStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStatus === 'grace' && (
              <div>
                <label className="text-xs uppercase text-muted-foreground">Tolerar até</label>
                <Input type="datetime-local" value={graceUntil} onChange={(e) => setGraceUntil(e.target.value)} />
              </div>
            )}
            <div>
              <label className="text-xs uppercase text-muted-foreground">Nota interna</label>
              <Textarea value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdating(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={submitUpdate} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: 'destructive' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'destructive' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default AdminSponsorBillingPage;
