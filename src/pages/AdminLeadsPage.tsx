import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText, Search, Edit2, Trash2, TrendingUp, Phone, Wrench,
  Building2, Calendar, Inbox, Sparkles, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import PaginationControls from '@/components/PaginationControls';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import SelectionCheckbox from '@/components/admin/SelectionCheckbox';
import LeadEditDialog from '@/components/admin/LeadEditDialog';
import { useAdminBulkActions } from '@/hooks/useAdminBulkActions';
import { logAuditAction } from '@/hooks/useAuditLog';
import { useDebounce } from '@/hooks/useDebounce';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 30;

const STATUS_META: Record<string, { label: string; icon: any; cls: string; dot: string }> = {
  new:       { label: 'Novo',       icon: Sparkles,      cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',          dot: 'bg-blue-500' },
  contacted: { label: 'Contatado',  icon: Clock,         cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',     dot: 'bg-amber-500' },
  converted: { label: 'Convertido', icon: CheckCircle2,  cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-500' },
  closed:    { label: 'Fechado',    icon: XCircle,       cls: 'bg-muted text-muted-foreground border-border',                                dot: 'bg-muted-foreground' },
};

const FILTER_TABS = [
  { key: 'all',       label: 'Todos' },
  { key: 'new',       label: 'Novos' },
  { key: 'contacted', label: 'Contatados' },
  { key: 'converted', label: 'Convertidos' },
  { key: 'closed',    label: 'Fechados' },
];

const factorLabels: Record<string, string> = {
  name: 'Nome', phone: 'Telefone', service: 'Serviço',
  message: 'Mensagem', provider_plan: 'Plano', recency: 'Recência',
};

const scoreTier = (score: number) => {
  if (score >= 80) return { label: 'Excelente', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20' };
  if (score >= 60) return { label: 'Bom',       cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20' };
  if (score >= 40) return { label: 'Regular',   cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/20' };
  return { label: 'Baixo', cls: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/20' };
};

const AdminLeadsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editLead, setEditLead] = useState<any | null>(null);
  const debouncedSearch = useDebounce(search ?? '', 300);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*, providers(business_name)')
      .order('lead_score', { ascending: false });
    if (error) { toast.error('Erro: ' + error.message); return; }
    setLeads(data || []);
  };

  useEffect(() => { if (isAdmin) fetchLeads(); }, [isAdmin]);

  const bulk = useAdminBulkActions({
    table: 'leads',
    resourceType: 'lead',
    onComplete: fetchLeads,
  });

  const stats = useMemo(() => {
    const total = leads.length;
    const counts = { new: 0, contacted: 0, converted: 0, closed: 0 };
    let scoreSum = 0, scored = 0;
    leads.forEach(l => {
      const s = (l.status || 'new') as keyof typeof counts;
      if (s in counts) counts[s]++;
      if (typeof l.lead_score === 'number') { scoreSum += l.lead_score; scored++; }
    });
    const avg = scored ? Math.round(scoreSum / scored) : 0;
    const conversionRate = total ? Math.round((counts.converted / total) * 100) : 0;
    return { total, new: counts.new, contacted: counts.contacted, converted: counts.converted, closed: counts.closed, avg, conversionRate };
  }, [leads]);

  const filtered = useMemo(() => {
    let list = Array.isArray(leads) ? leads : [];
    if (statusFilter !== 'all') list = list.filter(l => (l.status || 'new') === statusFilter);
    if (scoreFilter !== 'all') {
      list = list.filter(l => {
        const s = l.lead_score || 0;
        if (scoreFilter === 'hot') return s >= 80;
        if (scoreFilter === 'warm') return s >= 60 && s < 80;
        if (scoreFilter === 'cold') return s < 60;
        return true;
      });
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      const safe = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : v == null ? '' : String(v).toLowerCase());
      try {
        list = list.filter(l =>
          safe(l.client_name).includes(q) ||
          safe(l.phone).includes(q) ||
          safe(l.service_needed).includes(q) ||
          safe(l.providers?.business_name).includes(q) ||
          safe(l.message).includes(q)
        );
      } catch (err) {
        console.error('[AdminLeads] filter error:', err);
      }
    }
    return list;
  }, [leads, debouncedSearch, statusFilter, scoreFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lead permanentemente?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    await logAuditAction({ action: 'delete', resource_type: 'lead', resource_id: id });
    toast.success('Lead excluído');
    fetchLeads();
  };

  if (loading) return <AdminLayout><p className="p-4 text-muted-foreground">Carregando…</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-5 p-1">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Gerenciar Leads</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{filtered.length}</span> de {stats.total} leads · Score médio <span className="font-semibold text-foreground">{stats.avg}</span> · {stats.conversionRate}% conversão
              </p>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total',        value: stats.total,     icon: Inbox,        cls: 'bg-primary/10 text-primary' },
            { label: 'Novos',        value: stats.new,       icon: Sparkles,     cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
            { label: 'Contatados',   value: stats.contacted, icon: Clock,        cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
            { label: 'Convertidos',  value: stats.converted, icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
          ].map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{k.value}</p>
                  </div>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${k.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map(t => {
              const active = statusFilter === t.key;
              const count = t.key === 'all' ? stats.total : (stats as any)[t.key] || 0;
              return (
                <button
                  key={t.key}
                  onClick={() => { setStatusFilter(t.key); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 py-0 text-[10px] font-mono ${active ? 'bg-primary-foreground/20' : 'bg-background/60'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar cliente, telefone, serviço, prestador, mensagem…"
                className="pl-9 h-10"
              />
            </div>
            <Select value={scoreFilter} onValueChange={v => { setScoreFilter(v); setPage(1); }}>
              <SelectTrigger className="h-10 w-full sm:w-44">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os scores</SelectItem>
                <SelectItem value="hot">🔥 Quente (80+)</SelectItem>
                <SelectItem value="warm">Morno (60-79)</SelectItem>
                <SelectItem value="cold">Frio (&lt; 60)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {bulk.hasSelection && (
          <BulkActionsBar
            count={bulk.selectionCount}
            onClear={bulk.clearSelection}
            onExport={() => bulk.exportSelected(filtered, 'leads')}
            loading={bulk.bulkLoading}
          >
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'contacted' })} disabled={bulk.bulkLoading} className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10">
              <Clock className="h-3.5 w-3.5 mr-1" /> Marcar Contatado
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk.bulkUpdate({ status: 'converted' })} disabled={bulk.bulkLoading} className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar Convertido
            </Button>
          </BulkActionsBar>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Score</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Contato</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Serviço</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Prestador</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Quando</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(l => {
                  const tier = scoreTier(l.lead_score || 0);
                  const sm = STATUS_META[l.status] || STATUS_META.new;
                  const StatusIcon = sm.icon;
                  return (
                    <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3">
                        <SelectionCheckbox checked={bulk.selectedIds.has(l.id)} onCheckedChange={() => bulk.toggleSelection(l.id)} />
                      </td>
                      <td className="px-3 py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold cursor-default ring-1 ${tier.cls}`}>
                              <TrendingUp className="h-3 w-3" />
                              {l.lead_score || 0}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs max-w-[220px]">
                            <p className="font-bold mb-1">{tier.label}</p>
                            {l.score_factors && typeof l.score_factors === 'object' && Object.entries(l.score_factors).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-3">
                                <span className="text-muted-foreground">{factorLabels[k] || k}</span>
                                <span className="font-mono font-semibold">{String(v)}</span>
                              </div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-foreground truncate max-w-[180px]">{l.client_name || '—'}</div>
                        <div className="text-[11px] text-muted-foreground sm:hidden flex items-center gap-1 mt-0.5">
                          <Phone className="h-2.5 w-2.5" /> {l.phone}
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="font-mono">{l.phone || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[180px]">
                          <Wrench className="h-3 w-3 shrink-0" />
                          <span className="truncate">{l.service_needed || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[160px]">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{l.providers?.business_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={`gap-1 text-[10px] font-semibold ${sm.cls}`}>
                          <StatusIcon className="h-3 w-3" />
                          {sm.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        {l.created_at ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
                                <Calendar className="h-3 w-3" />
                                {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{format(new Date(l.created_at), "dd/MM/yyyy 'às' HH:mm")}</TooltipContent>
                          </Tooltip>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-0.5">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditLead(l)} title="Editar">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-destructive/10" onClick={() => handleDelete(l.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <Inbox className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Nenhum lead encontrado</p>
                        <p className="text-xs text-muted-foreground">
                          {search || statusFilter !== 'all' || scoreFilter !== 'all' ? 'Ajuste os filtros para ver mais resultados' : 'Os leads aparecerão aqui quando os clientes contatarem profissionais'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {Math.ceil(filtered.length / PAGE_SIZE) > 1 && (
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        )}

        <LeadEditDialog lead={editLead} onClose={() => setEditLead(null)} onSaved={fetchLeads} />
      </div>
    </AdminLayout>
  );
};

export default AdminLeadsPage;
