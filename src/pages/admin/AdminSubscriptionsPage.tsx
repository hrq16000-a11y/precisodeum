/**
 * AdminSubscriptionsPage — visualização read-only de assinaturas
 * (tabela `subscriptions`).
 *
 * Schema real: id, provider_id, plan, status, starts_at, ends_at,
 * created_at, account_type_id.
 *
 * Sem create/edit/delete: assinaturas são gerenciadas pelo sistema de
 * pagamento — este painel é apenas observabilidade.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { CreditCard, Search, Ban, CalendarPlus } from 'lucide-react';
import PaginationControls from '@/components/PaginationControls';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

const PAGE_SIZE = 20;


type Sub = {
  id: string;
  provider_id: string;
  plan: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  account_type_id: string | null;
};

type AccountType = { id: string; label?: string; name?: string; slug?: string };

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-muted text-muted-foreground',
};

const AdminSubscriptionsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [profileFilter, setProfileFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [cancelTarget, setCancelTarget] = useState<Sub | null>(null);
  const [extendTarget, setExtendTarget] = useState<Sub | null>(null);
  const [extendDays, setExtendDays] = useState<number>(30);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions' as any)
        .select('id, provider_id, plan, status, starts_at, ends_at, created_at, account_type_id')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as unknown as Sub[];
    },
  });

  const providerIds = useMemo(() => Array.from(new Set(subs.map((s) => s.provider_id))), [subs]);

  const { data: providerNames = new Map<string, string>() } = useQuery({
    queryKey: ['admin-subscriptions-provider-names', providerIds.length],
    enabled: isAdmin && providerIds.length > 0,
    queryFn: async () => {
      const m = new Map<string, string>();
      const { data: provs } = await supabase
        .from('providers' as any)
        .select('id, business_name')
        .in('id', providerIds);
      (provs as any[] | null)?.forEach((p) => { if (p.business_name) m.set(p.id, p.business_name); });
      const missing = providerIds.filter((id) => !m.has(id));
      if (missing.length) {
        const { data: profs } = await supabase
          .from('profiles' as any)
          .select('id, full_name')
          .in('id', missing);
        (profs as any[] | null)?.forEach((p) => { if (p.full_name) m.set(p.id, p.full_name); });
      }
      return m;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (sub: Sub) => {
      const { error } = await supabase
        .from('subscriptions' as any)
        .update({ status: 'canceled' } as any)
        .eq('id', sub.id);
      if (error) throw error;
      await logAuditAction({ action: 'subscription_changed', resource_type: 'subscription', resource_id: sub.id, details: { previous_status: sub.status } });
      return sub.id;
    },
    onSuccess: (id) => {
      qc.setQueryData<Sub[]>(['admin-subscriptions'], (prev) =>
        (prev || []).map((s) => (s.id === id ? { ...s, status: 'canceled' } : s))
      );
      toast.success('Assinatura cancelada');
      setCancelTarget(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao cancelar'),
  });

  const extendMutation = useMutation({
    mutationFn: async ({ sub, days }: { sub: Sub; days: number }) => {
      const base = sub.ends_at ? new Date(sub.ends_at) : new Date();
      const next = new Date(base.getTime() + days * 86_400_000);
      const newEnd = next.toISOString();
      const { error } = await supabase
        .from('subscriptions' as any)
        .update({ ends_at: newEnd } as any)
        .eq('id', sub.id);
      if (error) throw error;
      await logAuditAction({ action: 'subscription_changed', resource_type: 'subscription', resource_id: sub.id, details: { days, new_ends_at: newEnd } });
      return { id: sub.id, newEnd };
    },
    onSuccess: ({ id, newEnd }) => {
      qc.setQueryData<Sub[]>(['admin-subscriptions'], (prev) =>
        (prev || []).map((s) => (s.id === id ? { ...s, ends_at: newEnd } : s))
      );
      toast.success(`Assinatura estendida até ${new Date(newEnd).toLocaleDateString('pt-BR')}`);
      setExtendTarget(null);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao estender'),
  });


  const { data: accountTypes = [] } = useQuery({
    queryKey: ['admin-subscriptions-account-types'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_types' as any)
        .select('*');
      if (error) return [] as AccountType[];
      return (data || []) as unknown as AccountType[];
    },
  });

  const accountTypeLabel = useMemo(() => {
    const m = new Map<string, string>();
    accountTypes.forEach((a) => m.set(a.id, a.label || a.name || a.slug || a.id));
    return m;
  }, [accountTypes]);

  const planOptions = useMemo(() => {
    const set = new Set<string>();
    subs.forEach((s) => set.add(s.plan));
    return Array.from(set).sort();
  }, [subs]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    subs.forEach((s) => set.add(s.status));
    return Array.from(set).sort();
  }, [subs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    return subs.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (profileFilter !== 'all') {
        const lbl = (s.account_type_id && accountTypeLabel.get(s.account_type_id)) || '';
        if (lbl !== profileFilter) return false;
      }
      const created = new Date(s.created_at).getTime();
      if (from && created < from) return false;
      if (to && created > to) return false;
      if (q) {
        const blob = `${s.provider_id} ${s.plan} ${s.status}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [subs, search, statusFilter, profileFilter, dateFrom, dateTo, accountTypeLabel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const profileOptions = useMemo(() => {
    const set = new Set<string>();
    accountTypeLabel.forEach((v) => set.add(v));
    return Array.from(set).sort();
  }, [accountTypeLabel]);

  if (adminLoading) {
    return <AdminLayout><div className="h-8 w-1/3 animate-pulse rounded-lg bg-muted" /></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Assinaturas
          </h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {subs.length} — somente leitura (gerenciado pelo sistema de pagamento)
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar provider, plano..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={profileFilter} onValueChange={(v) => { setProfileFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de perfil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              {profileOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <Input type="date" className="w-40" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tipo de perfil</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma assinatura</TableCell></TableRow>
              ) : (
                paginated.map((s) => {
                  const canCancel = s.status === 'active' || s.status === 'trialing';
                  const name = providerNames.get(s.provider_id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">
                        {name ? <span className="font-medium">{name}</span> : <span className="font-mono">{s.provider_id?.slice(0, 8)}…</span>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{s.plan}</Badge></TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${STATUS_COLORS[s.status] || 'bg-muted'}`}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.account_type_id ? (accountTypeLabel.get(s.account_type_id) || '—') : '—'}
                      </TableCell>
                      <TableCell className="text-xs">{s.starts_at ? new Date(s.starts_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell className="text-xs">{s.ends_at ? new Date(s.ends_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canCancel && (
                            <Button size="icon" variant="ghost" aria-label="Cancelar"
                              onClick={() => setCancelTarget(s)}>
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" aria-label="Estender"
                            onClick={() => { setExtendTarget(s); setExtendDays(30); }}>
                            <CalendarPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>

      {/* Cancelar */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar assinatura de{' '}
              <strong>
                {cancelTarget ? (providerNames.get(cancelTarget.provider_id) || cancelTarget.provider_id) : ''}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (cancelTarget) cancelMutation.mutate(cancelTarget); }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Estender */}
      <Dialog open={!!extendTarget} onOpenChange={(o) => !o && setExtendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estender assinatura</DialogTitle>
            <DialogDescription>
              {extendTarget ? (providerNames.get(extendTarget.provider_id) || extendTarget.provider_id) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Estender por quantos dias?</Label>
              <Input
                type="number" min={1} max={365}
                value={extendDays}
                onChange={(e) => setExtendDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              />
            </div>
            {extendTarget && (
              <p className="text-sm text-muted-foreground">
                Nova data de expiração:{' '}
                <strong className="text-foreground">
                  {new Date(
                    (extendTarget.ends_at ? new Date(extendTarget.ends_at).getTime() : Date.now())
                    + extendDays * 86_400_000
                  ).toLocaleDateString('pt-BR')}
                </strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => extendTarget && extendMutation.mutate({ sub: extendTarget, days: extendDays })}
              disabled={extendMutation.isPending || extendDays < 1 || extendDays > 365}
            >
              {extendMutation.isPending ? 'Estendendo...' : 'Confirmar extensão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSubscriptionsPage;

