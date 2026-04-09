import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search, Download, CreditCard, Clock, CheckCircle2, XCircle, DollarSign, TrendingUp, RefreshCcw, Ban, Pause, ArrowUpDown, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { syncSubscriptionToProfile } from '@/hooks/useSubscriptionSync';
import PaginationControls from '@/components/PaginationControls';
import { toast } from 'sonner';
import { format, differenceInDays, subDays } from 'date-fns';

const PAGE_SIZE = 20;

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Ativa', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  expired: { label: 'Expirada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  canceled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', icon: Ban },
  trial: { label: 'Trial', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  suspended: { label: 'Suspensa', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: Pause },
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

  const { data: accountTypes = [] } = useQuery({
    queryKey: ['admin-account-types-subs'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from('account_types').select('id, name, price, color').order('price');
      return (data || []) as any[];
    },
  });

  const providerMap = useMemo(() => {
    const m: Record<string, any> = {};
    providers.forEach((p: any) => { m[p.id] = p; });
    return m;
  }, [providers]);

  const atMap = useMemo(() => {
    const m: Record<string, any> = {};
    accountTypes.forEach((a: any) => { m[a.id] = a; });
    return m;
  }, [accountTypes]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [upgradeAccountTypeId, setUpgradeAccountTypeId] = useState<string>('');

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

  // ── MRR + LTV + Churn ──
  const metrics = useMemo(() => {
    let totalMrr = 0;
    const byPlan: Record<string, { count: number; revenue: number }> = {};
    let activeCount = 0;

    subscriptions.forEach((s: any) => {
      if (s.status === 'active' || s.status === 'trial') {
        const at = s.account_type_id ? atMap[s.account_type_id] : null;
        const price = at?.price || 0;
        totalMrr += price;
        activeCount++;
        const planKey = at?.name || s.plan || 'free';
        if (!byPlan[planKey]) byPlan[planKey] = { count: 0, revenue: 0 };
        byPlan[planKey].count++;
        byPlan[planKey].revenue += price;
      }
    });

    const thirtyDaysAgo = subDays(new Date(), 30);
    const canceledRecent = subscriptions.filter((s: any) => s.status === 'canceled' && new Date(s.created_at) >= thirtyDaysAgo).length;
    const totalForChurn = subscriptions.length || 1;
    const churnRate = ((canceledRecent / totalForChurn) * 100).toFixed(1);

    // Simple LTV = ARPU * avg lifetime (months)
    const arpu = activeCount > 0 ? totalMrr / activeCount : 0;
    const avgLifetimeMonths = 12; // simplified assumption
    const ltv = arpu * avgLifetimeMonths;

    return { totalMrr, byPlan, churnRate, ltv, activeCount };
  }, [subscriptions, atMap]);

  // ── Actions ──
  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, plan, accountTypeId }: { id: string; newStatus: string; plan?: string; accountTypeId?: string }) => {
      const sub = subscriptions.find((s: any) => s.id === id);
      const update: any = { status: newStatus };

      if (newStatus === 'active' && plan) {
        update.starts_at = new Date().toISOString();
        update.ends_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      if (accountTypeId) {
        update.account_type_id = accountTypeId;
      }

      const { error } = await supabase.from('subscriptions' as any).update(update).eq('id', id);
      if (error) throw error;

      // Auto-sync profile
      if (sub) {
        await syncSubscriptionToProfile({
          subscriptionId: id,
          providerId: sub.provider_id,
          newStatus,
          newAccountTypeId: accountTypeId || sub.account_type_id,
          previousStatus: sub.status,
          previousAccountTypeId: sub.account_type_id,
        });
      }
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
    const csv = ['Prestador,Plano,Tipo Conta,Status,Início,Fim,Criado em'].concat(
      rows.map((s: any) => {
        const p = providerMap[s.provider_id];
        const at = s.account_type_id ? atMap[s.account_type_id] : null;
        return `"${p?.business_name || s.provider_id}","${s.plan}","${at?.name || ''}","${s.status}","${s.starts_at}","${s.ends_at || ''}","${s.created_at}"`;
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
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          <Card className="col-span-2 border-primary/30 bg-primary/5">
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold text-primary uppercase">MRR</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                R$ {metrics.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(metrics.byPlan).map(([plan, info]) => (
                  <Badge key={plan} variant="outline" className="text-[9px]">
                    {plan}: {info.count} (R$ {info.revenue.toFixed(0)})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Churn</span>
              </div>
              <p className="text-lg font-bold text-foreground">{metrics.churnRate}%</p>
              <p className="text-[9px] text-muted-foreground">30 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">LTV Est.</span>
              </div>
              <p className="text-lg font-bold text-foreground">R$ {metrics.ltv.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground">12m estimado</p>
            </CardContent>
          </Card>

          {Object.entries(STATUS_MAP).slice(0, 4).map(([key, { label, icon: Icon }]) => (
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
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestador</TableHead>
                <TableHead>Tipo Conta</TableHead>
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
                const at = s.account_type_id ? atMap[s.account_type_id] : null;
                const daysLeft = s.ends_at ? differenceInDays(new Date(s.ends_at), new Date()) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{prov?.business_name || prov?.slug || s.provider_id.slice(0, 8)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs" style={at?.color ? { borderColor: at.color, color: at.color } : undefined}>
                        {at?.name || s.plan}
                      </Badge>
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
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setDetailItem(s); setUpgradeAccountTypeId(s.account_type_id || ''); setDetailDialog(true); }}>
                        Detalhes
                      </Button>
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
              const at = detailItem.account_type_id ? atMap[detailItem.account_type_id] : null;
              const daysLeft = detailItem.ends_at ? differenceInDays(new Date(detailItem.ends_at), new Date()) : null;
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border p-3 space-y-2 text-sm">
                    <p className="font-semibold">{prov?.business_name || prov?.slug || detailItem.provider_id.slice(0, 8)}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Tipo Conta:</span> <Badge variant="outline">{at?.name || 'Não vinculado'}</Badge></div>
                      <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_MAP[detailItem.status]?.color}>{STATUS_MAP[detailItem.status]?.label || detailItem.status}</Badge></div>
                      <div><span className="text-muted-foreground">Início:</span> {format(new Date(detailItem.starts_at), 'dd/MM/yyyy')}</div>
                      <div><span className="text-muted-foreground">Fim:</span> {detailItem.ends_at ? format(new Date(detailItem.ends_at), 'dd/MM/yyyy') : '—'}</div>
                      <div><span className="text-muted-foreground">Valor:</span> R$ {(at?.price || 0).toFixed(2)}/mês</div>
                      <div><span className="text-muted-foreground">Dias:</span> {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft}` : 'Vencida') : '∞'}</div>
                    </div>
                  </div>

                  {/* Upgrade/Downgrade selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1"><ArrowUpDown className="h-3.5 w-3.5" /> Alterar Tipo de Conta</Label>
                    <Select value={upgradeAccountTypeId} onValueChange={setUpgradeAccountTypeId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar tipo..." /></SelectTrigger>
                      <SelectContent>
                        {accountTypes.map((at: any) => (
                          <SelectItem key={at.id} value={at.id}>
                            {at.name} — R$ {Number(at.price).toFixed(2)}/mês
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {detailItem.status !== 'active' && (
                      <Button size="sm" className="flex-1" onClick={() => changeStatusMutation.mutate({ id: detailItem.id, newStatus: 'active', plan: detailItem.plan, accountTypeId: upgradeAccountTypeId || undefined })} disabled={changeStatusMutation.isPending}>
                        <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Renovar
                      </Button>
                    )}
                    {detailItem.status === 'active' && upgradeAccountTypeId && upgradeAccountTypeId !== detailItem.account_type_id && (
                      <Button size="sm" className="flex-1" onClick={() => changeStatusMutation.mutate({ id: detailItem.id, newStatus: 'active', accountTypeId: upgradeAccountTypeId })} disabled={changeStatusMutation.isPending}>
                        <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Alterar Plano
                      </Button>
                    )}
                    {detailItem.status === 'active' && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => changeStatusMutation.mutate({ id: detailItem.id, newStatus: 'suspended' })} disabled={changeStatusMutation.isPending}>
                        <Pause className="h-3.5 w-3.5 mr-1" /> Suspender
                      </Button>
                    )}
                    {detailItem.status !== 'canceled' && (
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => {
                        if (confirm('Cancelar esta assinatura? O perfil será rebaixado automaticamente.')) changeStatusMutation.mutate({ id: detailItem.id, newStatus: 'canceled' });
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
