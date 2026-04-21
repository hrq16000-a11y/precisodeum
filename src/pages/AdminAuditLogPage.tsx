import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { ScrollText, Search, ChevronDown, ChevronUp, Download, Filter, Trophy, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationControls from '@/components/PaginationControls';
import { logAuditAction } from '@/hooks/useAuditLog';
import { toast } from 'sonner';

const actionLabels: Record<string, { label: string; color: string; group: string }> = {
  create: { label: 'Criação', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', group: 'crud' },
  update: { label: 'Edição', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', group: 'crud' },
  delete: { label: 'Exclusão', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', group: 'crud' },
  soft_delete: { label: 'Lixeira', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', group: 'crud' },
  restore: { label: 'Restauração', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300', group: 'crud' },
  approve: { label: 'Aprovação', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', group: 'mod' },
  reject: { label: 'Rejeição', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', group: 'mod' },
  bulk_delete: { label: 'Exclusão em lote', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', group: 'crud' },
  bulk_update: { label: 'Edição em lote', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', group: 'crud' },
  export: { label: 'Exportação', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', group: 'mod' },
  block: { label: 'Bloqueio', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', group: 'mod' },
  unblock: { label: 'Desbloqueio', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', group: 'mod' },
  next_step_chosen: { label: 'Sugestão aceita', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', group: 'engagement' },
  next_step_dismissed: { label: 'Sugestão ignorada', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300', group: 'engagement' },
  level_up: { label: 'Nível atingido', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', group: 'engagement' },
  achievement: { label: 'Conquista', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', group: 'engagement' },
  settings_updated: { label: 'Limite alterado', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', group: 'limits' },
  limit_changed: { label: 'Limite alterado', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', group: 'limits' },
};

const resourceLabels: Record<string, string> = {
  provider: 'Prestador',
  job: 'Vaga',
  user: 'Usuário',
  sponsor: 'Patrocinador',
  blog_post: 'Notícia',
  category: 'Categoria',
  service: 'Serviço',
  next_step_prompt: 'Copiloto UX',
  site_settings: 'Configurações',
  portfolio_album: 'Álbum',
  portfolio_photo: 'Foto',
};

// Quick filter presets
const QUICK_FILTERS: Array<{ key: string; label: string; icon: any; actions: string[] }> = [
  { key: 'all', label: 'Tudo', icon: Filter, actions: [] },
  { key: 'engagement', label: 'Conquistas', icon: Trophy, actions: ['next_step_chosen', 'next_step_dismissed', 'level_up', 'achievement'] },
  { key: 'limits', label: 'Limites', icon: SettingsIcon, actions: ['settings_updated', 'limit_changed'] },
  { key: 'errors', label: 'Erros / Bloqueios', icon: AlertTriangle, actions: ['block', 'reject', 'delete', 'bulk_delete'] },
];

const PAGE_SIZE = 25;

// Local YYYY-MM-DD helpers (avoid UTC drift)
const toLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AdminAuditLogPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { name: string; user_ref: string | null }>>(new Map());
  const [search, setSearch] = useState('');
  const [userRefSearch, setUserRefSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResource, setFilterResource] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const buildBaseQuery = (forCount = false) => {
    let query = supabase.from('audit_log' as any).select('*', forCount ? { count: 'exact' } : undefined);

    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    } else {
      const preset = QUICK_FILTERS.find(f => f.key === quickFilter);
      if (preset && preset.actions.length > 0) query = query.in('action', preset.actions);
    }
    if (filterResource !== 'all') query = query.eq('resource_type', filterResource);
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);
    return query;
  };

  const resolveUserIdsFromRef = async (refQuery: string): Promise<string[] | null> => {
    const trimmed = refQuery.trim();
    if (!trimmed) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id, user_ref')
      .ilike('user_ref', `%${trimmed}%`)
      .limit(50);
    return (data || []).map(p => p.id);
  };

  const fetchLogs = async () => {
    let query = buildBaseQuery(true).order('created_at', { ascending: false });

    // user_ref filter
    if (userRefSearch.trim()) {
      const userIds = await resolveUserIdsFromRef(userRefSearch);
      if (!userIds || userIds.length === 0) {
        setLogs([]);
        setTotalCount(0);
        return;
      }
      query = query.in('user_id', userIds);
    }

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, count } = await query;
    const items = (data || []) as any[];
    setLogs(items);
    setTotalCount(count || 0);

    // Resolve names + user_refs
    const userIds = [...new Set(items.map((l: any) => l.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, user_ref')
        .in('id', userIds);
      setProfiles(new Map((profileData || []).map(p => [p.id, { name: p.full_name, user_ref: p.user_ref }])));
    }
  };

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin, page, filterAction, filterResource, quickFilter, dateFrom, dateTo, userRefSearch]);

  const handleExportCsv = async () => {
    // Confirmation preview — show how many records AND which columns will be exported
    const visibleCount = totalCount;
    if (visibleCount === 0) {
      toast.info('Nenhum registro para exportar com esses filtros.');
      return;
    }
    const cap = Math.min(visibleCount, 5000);
    const columns = ['data', 'usuario', 'user_ref', 'acao', 'recurso', 'recurso_id', 'detalhes'];
    const ok = window.confirm(
      `🗂️ Você está prestes a exportar ${cap} registro(s)${visibleCount > 5000 ? ` (limite de 5.000 — ${visibleCount} encontrados no total)` : ''}.\n\n` +
      `Colunas incluídas no CSV:\n  • ${columns.join('\n  • ')}\n\nDeseja continuar?`
    );
    if (!ok) return;

    setExporting(true);
    try {
      // Pull up to 5000 rows respecting current filters (no pagination)
      let query = buildBaseQuery(false).order('created_at', { ascending: false }).limit(5000);
      if (userRefSearch.trim()) {
        const userIds = await resolveUserIdsFromRef(userRefSearch);
        if (!userIds || userIds.length === 0) {
          toast.error('Nenhum registro para exportar.');
          setExporting(false);
          return;
        }
        query = query.in('user_id', userIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) {
        toast.info('Nenhum registro para exportar.');
        setExporting(false);
        return;
      }

      // Resolve user names for export
      const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      let profileMap = new Map<string, { name: string; user_ref: string | null }>();
      if (ids.length > 0) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, full_name, user_ref')
          .in('id', ids);
        profileMap = new Map((pData || []).map(p => [p.id, { name: p.full_name, user_ref: p.user_ref }]));
      }

      const header = ['data', 'usuario', 'user_ref', 'acao', 'recurso', 'recurso_id', 'detalhes'];
      const escape = (v: unknown) => {
        const s = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [
        header.join(','),
        ...rows.map(r => {
          const p = profileMap.get(r.user_id);
          return [
            new Date(r.created_at).toISOString(),
            p?.name ?? '',
            p?.user_ref ?? '',
            r.action,
            r.resource_type,
            r.resource_id ?? '',
            r.details ?? {},
          ].map(escape).join(',');
        }),
      ].join('\n');

      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_${toLocalDate(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      void logAuditAction({
        action: 'export',
        resource_type: 'audit_log',
        details: { count: rows.length, filters: { filterAction, filterResource, quickFilter, dateFrom, dateTo, userRefSearch } },
      });
      toast.success(`${rows.length} registro(s) exportado(s)`);
    } catch (e: any) {
      toast.error('Erro ao exportar: ' + (e.message || 'desconhecido'));
    } finally {
      setExporting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      (profiles.get(l.user_id)?.name || '').toLowerCase().includes(q) ||
      (profiles.get(l.user_id)?.user_ref || '').toLowerCase().includes(q) ||
      (l.resource_type || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q)
    );
  }, [logs, profiles, search]);

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ScrollText className="h-6 w-6" /> Trilha de Auditoria
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórico estruturado de eventos da plataforma</p>
        </div>
        <Button onClick={handleExportCsv} disabled={exporting} variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </Button>
      </div>

      {/* Quick filter chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_FILTERS.map(f => {
          const Icon = f.icon;
          const active = quickFilter === f.key && filterAction === 'all';
          return (
            <button
              key={f.key}
              onClick={() => { setQuickFilter(f.key); setFilterAction('all'); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Filters row 1 */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar nome, user_ref, recurso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Input
          placeholder="Filtrar por user_ref (ex: a1b2-c3d4)"
          value={userRefSearch}
          onChange={e => { setUserRefSearch(e.target.value); setPage(1); }}
          className="sm:w-64"
        />
      </div>

      {/* Filters row 2 */}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            {Object.entries(actionLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResource} onValueChange={v => { setFilterResource(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Recurso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos recursos</SelectItem>
            {Object.entries(resourceLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 sm:w-auto">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground uppercase">De</label>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} max={dateTo || undefined} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground uppercase">Até</label>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} min={dateFrom || undefined} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        <strong className="font-semibold text-foreground">{totalCount}</strong> registro(s) encontrado(s)
        {totalCount > 0 && (
          <span className="ml-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Pronto para exportar até {Math.min(totalCount, 5000)} linhas
          </span>
        )}
      </p>

      <div className="mt-2 space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Nenhum registro encontrado</p>
          </div>
        )}
        {filtered.map((log: any) => {
          const act = actionLabels[log.action] || { label: log.action, color: 'bg-muted text-muted-foreground' };
          const expanded = expandedId === log.id;
          const profile = profiles.get(log.user_id);
          const decisionMs = log?.details?.decision_ms;
          return (
            <div key={log.id} className="rounded-lg border border-border bg-card p-3 shadow-card">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : log.id)}
              >
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${act.color}`}>
                  {act.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {resourceLabels[log.resource_type] || log.resource_type}
                    {log.resource_id && <span className="text-muted-foreground"> #{String(log.resource_id).slice(0, 8)}</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {profile?.name || 'Admin'}
                    {profile?.user_ref && <span className="ml-1 font-mono opacity-60">({profile.user_ref})</span>}
                    <span className="mx-1">•</span>
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                    {typeof decisionMs === 'number' && (
                      <span className="ml-2 inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                        decidiu em {(decisionMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </p>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              {expanded && log.details && Object.keys(log.details).length > 0 && (
                <pre className="mt-2 rounded bg-muted p-2 text-xs text-muted-foreground overflow-auto max-h-40">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {totalCount > PAGE_SIZE && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={totalCount} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAuditLogPage;
