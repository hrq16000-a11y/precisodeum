import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { ScrollText, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import PaginationControls from '@/components/PaginationControls';

const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: 'Criação', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  update: { label: 'Edição', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  delete: { label: 'Exclusão', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  soft_delete: { label: 'Lixeira', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  restore: { label: 'Restauração', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  approve: { label: 'Aprovação', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  reject: { label: 'Rejeição', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  bulk_delete: { label: 'Exclusão em lote', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  bulk_update: { label: 'Edição em lote', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  export: { label: 'Exportação', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  block: { label: 'Bloqueio', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  unblock: { label: 'Desbloqueio', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
};

const resourceLabels: Record<string, string> = {
  provider: 'Prestador',
  job: 'Vaga',
  user: 'Usuário',
  sponsor: 'Patrocinador',
  blog_post: 'Notícia',
  category: 'Categoria',
  service: 'Serviço',
};

const PAGE_SIZE = 25;

const AdminAuditLogPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResource, setFilterResource] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    let query = supabase
      .from('audit_log' as any)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (filterResource !== 'all') query = query.eq('resource_type', filterResource);

    const { data, count } = await query;
    const items = (data || []) as any[];
    setLogs(items);
    setTotalCount(count || 0);

    // Fetch user names
    const userIds = [...new Set(items.map((l: any) => l.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      setProfiles(new Map((profileData || []).map(p => [p.id, p.full_name])));
    }
  };

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin, page, filterAction, filterResource]);

  if (loading) return <AdminLayout><p className="text-muted-foreground p-4">Carregando...</p></AdminLayout>;

  const filtered = search.trim()
    ? logs.filter(l =>
        (profiles.get(l.user_id) || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.resource_type || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.action || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <ScrollText className="h-6 w-6" /> Trilha de Auditoria
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Histórico de todas as ações administrativas</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            {Object.entries(actionLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResource} onValueChange={v => { setFilterResource(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Recurso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos recursos</SelectItem>
            {Object.entries(resourceLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Nenhum registro encontrado</p>
          </div>
        )}
        {filtered.map((log: any) => {
          const act = actionLabels[log.action] || { label: log.action, color: 'bg-muted text-muted-foreground' };
          const expanded = expandedId === log.id;
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
                    {log.resource_id && <span className="text-muted-foreground"> #{log.resource_id.slice(0, 8)}</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {profiles.get(log.user_id) || 'Admin'} • {new Date(log.created_at).toLocaleString('pt-BR')}
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
