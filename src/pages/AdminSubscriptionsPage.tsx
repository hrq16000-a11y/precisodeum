import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search, Download, CreditCard, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import PaginationControls from '@/components/PaginationControls';
import { toast } from 'sonner';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Ativa', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  expired: { label: 'Expirada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  canceled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', icon: XCircle },
  trial: { label: 'Trial', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
};

const PLAN_MAP: Record<string, string> = { free: 'Gratuito', basic: 'Básico', premium: 'Premium', pro: 'Pro' };

const AdminSubscriptionsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();

  const { data: subscriptions = [], isLoading } = useQuery({
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

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
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
                <SelectItem key={k} value={k}>{v}</SelectItem>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((s: any) => {
                const prov = providerMap[s.provider_id];
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{prov?.business_name || prov?.slug || s.provider_id.slice(0, 8)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{PLAN_MAP[s.plan] || s.plan}</Badge>
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
                  </TableRow>
                );
              })}
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma assinatura encontrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptionsPage;
