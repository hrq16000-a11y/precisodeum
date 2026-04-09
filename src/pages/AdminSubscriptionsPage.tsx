import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search, Download, CreditCard, Clock, CheckCircle2, XCircle, DollarSign, TrendingUp, RefreshCcw, Ban, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import PaginationControls from '@/components/PaginationControls';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

const PAGE_SIZE = 20;

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Ativa', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  expired: { label: 'Expirada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  canceled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', icon: Ban },
  trial: { label: 'Trial', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  suspended: { label: 'Suspensa', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: Pause },
};

const PLAN_MAP: Record<string, { label: string; price: number }> = {
  free: { label: 'Gratuito', price: 0 },
  basic: { label: 'Básico', price: 49.90 },
  premium: { label: 'Premium', price: 99.90 },
  pro: { label: 'Pro', price: 199.90 },
};

const AdminSubscriptionsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['admin-subscriptions'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('subscriptions' as any).select('*').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['admin-providers-subs'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('providers').select('id, business_name, slug, phone');
      return (data || []) as any[];
    },
  });

  const providerMap = useMemo(() => {
    const m: Record<string, any> = {};
    providers.forEach((p: any) => { m[p.id] = p; });
    return m;
  }, [providers]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subscriptions.filter((s: any) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (planFilter !== 'all' && s.plan !== planFilter) return false;
      if (q) {
        const prov = providerMap[s.provider_id];
        const provName = prov?.business_name || prov?.slug || '';
        if (!provName.toLowerCase().includes(q) && !s.provider_id.includes(q)) return false;
      }
      return true;
    });
  }, [subscriptions, search, statusFilter, planFilter, providerMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    subscriptions.forEach((s: any) => { map[s.status] = (map[s.status] || 0) + 1; });
    return map;
  }, [subscriptions]);

  // ── MRR Calculation ──
  const mrrData = useMemo(() => {
    let totalMrr = 0;
    const byPlan: Record<string, { count: number; revenue: number }> = {};
    subscriptions.forEach((s: any) => {
      if (s.status === 'active' || s.status === 'trial') {
        const planInfo = PLAN_MAP[s.plan] || { price: 0 };
        totalMrr += planInfo.price;
        if (!byPlan[s.plan]) byPlan[s.plan] = { count: 0, revenue: 0 };
        byPlan[s.plan].count++;
        byPlan[s.plan].revenue += planInfo.price;
      }
    });
    return { totalMrr, byPlan };
  }, [subscriptions]);

  // ── Actions ──
  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, plan }: { id: string; newStatus: string; plan?: string }) => {
      const update: any = { status: newStatus };
      if (newStatus === 'active' && plan) {
        // Renew: set new end date 30 days from now
        update.starts_at = new Date().toISOString();
        update.ends_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      const { error } = await supabase.from('subscriptions' as any).update(update).eq('id', id);
      if (error) throw error;
      const actionMap: Record<string, string> = {
        active: 'subscription_created',
        canceled: 'subscription_canceled',
        suspended: 'update',
        expired: 'update',
      };
      await logAuditAction({
        action: 'update',
        resource_type: 'subscription',
        resource_id: id,
        details: { action_type: actionMap[newStatus] || 'update', new_status: newStatus },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success('Assinatura atualizada!');
      setDetailDialog(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCsv = () => {
    const rows = filtered.length > 0 ? filtered : subscriptions;
    const csv = ['Prestador,Plano,Status,Início,Fim,Criado em'].concat(
      rows.map((s: any) => {
        const p = providerMap[s.provider_id];
        return `"${p?.business_name || s.provider_id}","${s.plan}","${s.status}","${s.starts_at}","${s.ends_at || ''}","${s.created_at}"`;
      })
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `assinaturas_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} assinatura(s) exportada(s)`);
  };

  if (adminLoading) return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Assinaturas</h1>
            <p className="text-sm text-muted-foreground">{subscriptions.length} assinatura(s) registrada(s)</p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        </div>

        {/* MRR + KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {/* MRR Card */}
          <Card className="col-span-2 sm:col-span-1 lg:col-span-2 border-primary/30 bg-primary/5">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold text-primary uppercase">MRR</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                R$ {mrrData.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(mrrData.byPlan).map(([plan, info]) => (
                  <Badge key={plan} variant="outline" className="text-[9px]">
                    {PLAN_MAP[plan]?.label || plan}: {info.count} (R$ {info.revenue.toFixed(0)})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          {Object.entries(STATUS_MAP).map(([key, { label, icon: Icon }]) => (
            <Card key={key}>
              <CardContent className="pt-3 pb-2 flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/10 p-1.5"><Icon className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-tight">{statusCounts[key] || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar prestador..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={v => { setPlanFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Planos</SelectItem>
              {Object.entries(PLAN_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestador</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Início</TableHead>
                <TableHead className="hidden sm:table-cell">Fim</TableHead>
                <TableHead className="hidden md:table-cell">Dias Rest.</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s: any) => {
                const prov = providerMap[s.provider_id];
                const daysLeft = s.ends_at ? differenceInDays(new Date(s.ends_at), new Date()) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{prov?.business_name || prov?.slug || s.provider_id.slice(0, 8)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{PLAN_MAP[s.plan]?.label || s.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_MAP[s.status]?.color || ''}`}>
                        {STATUS_MAP[s.status]?.label || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {format(new Date(s.starts_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {s.ends_at ? format(new Date(s.ends_at), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {daysLeft !== null ? (
                        <span className={daysLeft <= 7 ? 'text-red-600 font-semibold' : daysLeft <= 30 ? 'text-amber-600' : 'text-muted-foreground'}>
                          {daysLeft > 0 ? `${daysLeft}d` : daysLeft === 0 ? 'Hoje' : 'Vencida'}
                        </span>
                      ) : '∞'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setDetailItem(s); setDetailDialog(true); }}>
                          Detalhes
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma assinatura encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />}

        {/* Detail Dialog */}
        <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Detalhes da Assinatura</DialogTitle></DialogHeader>
            {detailItem && (() => {
              const prov = providerMap[detailItem.provider_id];
              const daysLeft = detailItem.ends_at ? differenceInDays(new Date(detailItem.ends_at), new Date()) : null;
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border p-3 space-y-2 text-sm">
                    <p className="font-semibold">{prov?.business_name || prov?.slug || detailItem.provider_id.slice(0, 8)}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Plano:</span> <Badge variant="outline">{PLAN_MAP[detailItem.plan]?.label || detailItem.plan}</Badge></div>
                      <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_MAP[detailItem.status]?.color}>{STATUS_MAP[detailItem.status]?.label || detailItem.status}</Badge></div>
                      <div><span className="text-muted-foreground">Início:</span> {format(new Date(detailItem.starts_at), 'dd/MM/yyyy')}</div>
                      <div><span className="text-muted-foreground">Fim:</span> {detailItem.ends_at ? format(new Date(detailItem.ends_at), 'dd/MM/yyyy') : '—'}</div>
                      <div><span className="text-muted-foreground">Valor mensal:</span> R$ {(PLAN_MAP[detailItem.plan]?.price || 0).toFixed(2)}</div>
                      <div><span className="text-muted-foreground">Dias restantes:</span> {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft}` : 'Vencida') : '∞'}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {detailItem.status !== 'active' && (
                      <Button size="sm" className="flex-1" onClick={() => changeStatusMutation.mutate({ id: detailItem.id, newStatus: 'active', plan: detailItem.plan })} disabled={changeStatusMutation.isPending}>
                        <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Renovar
                      </Button>
                    )}
                    {detailItem.status === 'active' && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => changeStatusMutation.mutate({ id: detailItem.id, newStatus: 'suspended' })} disabled={changeStatusMutation.isPending}>
                        <Pause className="h-3.5 w-3.5 mr-1" /> Suspender
                      </Button>
                    )}
                    {detailItem.status !== 'canceled' && (
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => {
                        if (confirm('Cancelar esta assinatura?')) changeStatusMutation.mutate({ id: detailItem.id, newStatus: 'canceled' });
                      }} disabled={changeStatusMutation.isPending}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptionsPage;
