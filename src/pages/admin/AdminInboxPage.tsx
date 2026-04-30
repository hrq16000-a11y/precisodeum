/**
 * AdminInboxPage — Centro de notificações pessoais do admin.
 *
 * Mostra as notificações recebidas pelo admin logado (incluindo as criadas
 * automaticamente pela rotina de integridade). Recursos:
 *  - Paginação (50/página)
 *  - Busca por título/mensagem
 *  - Filtro por status (todas / não lidas / lidas)
 *  - Marcar como lida (individual ou em massa) via RPC
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useSeoHead } from '@/hooks/useSeoHead';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Bell, Loader2, Check, CheckCheck, ChevronLeft, ChevronRight, ExternalLink, Search, Inbox,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotifRow {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  type: string | null;
  link: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

const AdminInboxPage = () => {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  useSeoHead({
    title: 'Caixa de notificações — Admin',
    description: 'Notificações recebidas, incluindo alertas automáticos de integridade.',
    noindex: true,
  });

  const [rows, setRows] = useState<NotifRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [order, setOrder] = useState<'date' | 'relevance'>('date');

  // Filtros avançados
  const [typeFilter, setTypeFilter] = useState<string>('__all__');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [providerId, setProviderId] = useState<string>('');
  const [typeOptions, setTypeOptions] = useState<Array<{ type: string; count: number }>>([]);

  // Carrega lista de tipos disponíveis para popular o filtro
  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await (supabase as any).rpc('list_user_notification_types');
      // Hardening: RPC pode retornar objeto/null em ambientes mockados — só array é renderizável.
      setTypeOptions(Array.isArray(data) ? (data as Array<{ type: string; count: number }>) : []);
    })();
  }, [user?.id]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const trimmed = search.trim();
    const effectiveOrder = trimmed ? order : 'date';

    const { data, error } = await (supabase as any).rpc('search_user_notifications', {
      _query: trimmed || null,
      _status: filter,
      _order: effectiveOrder,
      _limit: PAGE_SIZE,
      _offset: page * PAGE_SIZE,
      _type: typeFilter === '__all__' ? null : typeFilter,
      _from: dateFrom ? new Date(dateFrom + 'T00:00:00').toISOString() : null,
      _to: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null,
      _provider_id: providerId.trim() && /^[0-9a-f-]{36}$/i.test(providerId.trim()) ? providerId.trim() : null,
    });

    if (error) {
      toast.error('Falha ao carregar notificações');
      setRows([]);
      setTotal(0);
    } else {
      // Defensivo: a RPC pode devolver null, [], objeto único ou erro silencioso.
      // Sem o guard de Array.isArray um payload inesperado quebrava com
      // "list.map is not a function" e travava a inbox para o admin.
      const list: Array<NotifRow & { total_count?: number }> = Array.isArray(data) ? data : [];
      setRows(list.map(({ total_count, ...n }) => n));
      setTotal(Number(list[0]?.total_count ?? 0));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, filter, page, order, typeFilter, dateFrom, dateTo, providerId]);

  // Busca aplica reset de página
  useEffect(() => {
    if (page !== 0) setPage(0); else void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const markRead = async (id: string) => {
    setBusyId(id);
    const { error } = await (supabase as any).rpc('mark_notification_read', { _notification_id: id });
    setBusyId(null);
    if (error) {
      toast.error('Não foi possível marcar como lida');
      return;
    }
    setRows((r) => r.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllVisibleRead = async () => {
    const ids = rows.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setBulkBusy(true);
    const { error } = await (supabase as any).rpc('mark_notifications_read_bulk', { _ids: ids });
    setBulkBusy(false);
    if (error) {
      toast.error('Falha ao marcar em massa');
      return;
    }
    toast.success(`${ids.length} marcada(s) como lida(s)`);
    setRows((r) => r.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unreadVisible = useMemo(() => rows.filter((n) => !n.read).length, [rows]);

  if (adminLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Verificando permissões...
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <div>
            <h1 className="text-xl font-bold">Caixa de notificações</h1>
            <p className="text-xs text-muted-foreground">
              Alertas pessoais, incluindo integridade automática.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={markAllVisibleRead}
          disabled={bulkBusy || unreadVisible === 0}
          aria-label="Marcar todas as notificações visíveis como lidas"
        >
          {bulkBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
          Marcar página como lida ({unreadVisible})
        </Button>
      </header>

      <Card className="mb-4 p-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="filter" className="text-[11px] text-muted-foreground">Status</Label>
            <Select value={filter} onValueChange={(v) => { setPage(0); setFilter(v as any); }}>
              <SelectTrigger id="filter" aria-label="Filtrar status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unread">Não lidas</SelectItem>
                <SelectItem value="read">Lidas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="order" className="text-[11px] text-muted-foreground">Ordenar</Label>
            <Select
              value={order}
              onValueChange={(v) => { setPage(0); setOrder(v as 'date' | 'relevance'); }}
            >
              <SelectTrigger id="order" aria-label="Ordenação" disabled={!search.trim()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Mais recentes</SelectItem>
                <SelectItem value="relevance">Relevância</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="q" className="text-[11px] text-muted-foreground">Busca full-text</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                id="q"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Ex.: "integridade crítica", lead -spam, link...'
                className="pl-7"
                aria-label="Buscar notificações por título, mensagem, tipo ou link"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Suporta frase entre aspas, <code>-palavra</code> para excluir e busca em título, mensagem, tipo e link.
            </p>
          </div>
        </div>

        {/* Filtros avançados */}
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[12px] font-medium text-primary hover:underline list-none flex items-center gap-1">
            <span className="group-open:hidden">+ Filtros avançados</span>
            <span className="hidden group-open:inline">− Ocultar filtros avançados</span>
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="type-filter" className="text-[11px] text-muted-foreground">Tipo</Label>
              <Select value={typeFilter} onValueChange={(v) => { setPage(0); setTypeFilter(v); }}>
                <SelectTrigger id="type-filter" aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {t.type} ({t.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="from" className="text-[11px] text-muted-foreground">De</Label>
              <Input
                id="from"
                type="date"
                value={dateFrom}
                onChange={(e) => { setPage(0); setDateFrom(e.target.value); }}
                aria-label="Data inicial"
              />
            </div>
            <div>
              <Label htmlFor="to" className="text-[11px] text-muted-foreground">Até</Label>
              <Input
                id="to"
                type="date"
                value={dateTo}
                onChange={(e) => { setPage(0); setDateTo(e.target.value); }}
                aria-label="Data final"
              />
            </div>
            <div>
              <Label htmlFor="provider" className="text-[11px] text-muted-foreground">Provedor (UUID)</Label>
              <Input
                id="provider"
                type="text"
                value={providerId}
                onChange={(e) => { setPage(0); setProviderId(e.target.value); }}
                placeholder="ex: 9f7c..."
                aria-label="Filtrar por ID de provedor"
              />
            </div>
          </div>
          {(typeFilter !== '__all__' || dateFrom || dateTo || providerId) && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('__all__'); setDateFrom(''); setDateTo(''); setProviderId(''); setPage(0);
              }}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Limpar filtros avançados
            </button>
          )}
        </details>
      </Card>

      {loading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 h-6 w-6 opacity-40" />
          Nenhuma notificação no filtro atual.
        </Card>
      ) : (
        <ul className="space-y-2" aria-label="Lista de notificações">
          {rows.map((n) => (
            <li key={n.id}>
              <Card className={`p-3 ${!n.read ? 'border-primary/40 bg-primary/5' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!n.read && <Badge variant="destructive" className="text-[9px]">NOVA</Badge>}
                      {n.type && <Badge variant="outline" className="text-[9px]">{n.type}</Badge>}
                      <span className="text-sm font-semibold truncate">{n.title}</span>
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{n.message}</p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{fmt(n.created_at)}</span>
                      {n.link && (
                        <Link
                          to={n.link}
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                          aria-label={`Abrir página relacionada: ${n.link}`}
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead(n.id)}
                      disabled={busyId === n.id}
                      aria-label={`Marcar "${n.title}" como lida`}
                    >
                      {busyId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Paginação */}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages} · {total} total
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInboxPage;
