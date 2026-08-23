import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ExternalLink, Trash2, Mail, Star, Briefcase, CheckCircle, MessageCircle, Flame, Zap, TrendingUp, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuthIdentity } from '@/hooks/useAuth';
import { useNotifications, type Notification } from '@/hooks/useNotifications';

const typeIconMap: Record<string, React.ComponentType<any>> = {
  lead: Mail,
  review: Star,
  system: Bell,
  job: Briefcase,
  approval: CheckCircle,
  message: MessageCircle,
  lead_performance: TrendingUp,
  lead_ping: Flame,
  activity_signal: Zap,
};

const typeLabels: Record<string, string> = {
  lead: 'Leads',
  review: 'Avaliações',
  system: 'Sistema',
  job: 'Vagas',
  approval: 'Aprovações',
  message: 'Mensagens',
  lead_performance: '5+ cliques/24h',
  lead_ping: 'Ping de Sucesso',
  activity_signal: 'Sinal de Vida',
};

const PERFORMANCE_TYPES = new Set(['lead_performance', 'lead_ping', 'activity_signal']);

const NotificationRow = ({
  notification,
  onRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (link: string) => void;
}) => (
  <div
    className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-start sm:gap-4 ${
      notification.read
        ? 'border-border/60 bg-card'
        : 'border-accent/30 bg-accent/5'
    }`}
  >
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{(() => { const Icon = typeIconMap[notification.type] || Bell; return <Icon className="h-5 w-5 text-muted-foreground" />; })()}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${notification.read ? 'text-foreground' : 'text-foreground'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{notification.message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
          <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            {(() => { const Icon = typeIconMap[notification.type] || Bell; return <Icon className="inline h-3 w-3 mr-0.5" />; })()} {typeLabels[notification.type] || notification.type}
          </span>
          {!notification.read && <span className="text-accent">Nao lida</span>}
        </div>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
      {notification.link && (
        <button
          onClick={() => onNavigate(notification.link!)}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          title="Abrir"
        >
          <span className="inline-flex items-center gap-1"><ExternalLink className="h-3.5 w-3.5" /> Abrir</span>
        </button>
      )}
      {!notification.read && (
        <button
          onClick={() => onRead(notification.id)}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
          title="Marcar como lida"
        >
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Marcar lida</span>
        </button>
      )}
      <button
        onClick={() => onDelete(notification.id)}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
        title="Excluir"
      >
        <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Excluir</span>
      </button>
    </div>
  </div>
);

const PAGE_SIZE = 20;

const DashboardNotificationsPage = () => {
  const { user, loading } = useAuthIdentity();
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications({ limit: 200 });
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    notifications.forEach(n => { if (n.type) types.add(n.type); });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [notifications]);

  const performanceCount = useMemo(
    () => notifications.filter(n => PERFORMANCE_TYPES.has(n.type)).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null;
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return notifications.filter(n => {
      if (selectedType === '__performance__') {
        if (!PERFORMANCE_TYPES.has(n.type)) return false;
      } else if (selectedType !== 'all' && n.type !== selectedType) {
        return false;
      }
      if (term) {
        const hay = `${n.title || ''} ${n.message || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (fromTs || toTs) {
        const ts = new Date(n.created_at).getTime();
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      return true;
    });
  }, [notifications, selectedType, searchTerm, dateFrom, dateTo]);

  // Reset paginação ao mudar filtros
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedType, searchTerm, dateFrom, dateTo]);

  const visibleNotifications = filteredNotifications.slice(0, visibleCount);
  const hasMore = visibleCount < filteredNotifications.length;

  const clearFilters = () => {
    setSelectedType('all');
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
  };

  const handleNavigate = (link: string) => {
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else {
      navigate(link);
    }
  };

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Notificacoes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Historico completo com {notifications.length} notificacao{notifications.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard/notificacoes/preferencias')}
            className="gap-2"
          >
            <Settings className="h-4 w-4" /> Preferências
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead()} className="gap-2">
              <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedType('all')}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selectedType === 'all'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          Todas
        </button>
        {performanceCount > 0 && (
          <button
            onClick={() => setSelectedType('__performance__')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedType === '__performance__'
                ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/5'
            }`}
            title="Sinal de Vida + Ping de Sucesso + 5+ cliques/24h"
          >
            <TrendingUp className="inline h-3 w-3 mr-0.5" /> Performance ({performanceCount})
          </button>
        )}
        {availableTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selectedType === type
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {(() => { const Icon = typeIconMap[type] || Bell; return <Icon className="inline h-3 w-3 mr-0.5" />; })()} {typeLabels[type] || type}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="search"
          inputMode="search"
          placeholder="Buscar por título, mensagem ou cidade…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-accent/40"
          aria-label="Buscar notificações"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          aria-label="Data inicial"
          title="De"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          aria-label="Data final"
          title="Até"
        />
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Limpar
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Mostrando {visibleNotifications.length} de {filteredNotifications.length} resultado{filteredNotifications.length !== 1 ? 's' : ''}.
      </p>

      <div className="mt-4 space-y-3">
        {isLoading && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Carregando notificações...
          </div>
        )}

        {!isLoading && filteredNotifications.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/70" />
            <p className="mt-2 text-sm font-semibold text-foreground">Nenhuma notificação encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou aguarde novas notificações.</p>
          </div>
        )}

        {visibleNotifications.map(notification => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onRead={markAsRead}
            onDelete={deleteNotification}
            onNavigate={handleNavigate}
          />
        ))}

        {hasMore && (
          <div className="pt-2 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Carregar mais ({filteredNotifications.length - visibleCount} restantes)
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardNotificationsPage;
