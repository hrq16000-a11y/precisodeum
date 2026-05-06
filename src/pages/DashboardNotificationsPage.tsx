import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, type Notification } from '@/hooks/useNotifications';

const typeIcons: Record<string, string> = {
  lead: '📩',
  review: '⭐',
  system: '🔔',
  job: '💼',
  approval: '✅',
  message: '💬',
};

const typeLabels: Record<string, string> = {
  lead: 'Leads',
  review: 'Avaliacoes',
  system: 'Sistema',
  job: 'Vagas',
  approval: 'Aprovacoes',
  message: 'Mensagens',
};

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
      <span className="mt-0.5 text-lg">{typeIcons[notification.type] || '🔔'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${notification.read ? 'text-foreground' : 'text-foreground'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{notification.message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
          <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            {typeIcons[notification.type] || '🔔'} {typeLabels[notification.type] || notification.type}
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

const DashboardNotificationsPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications({ limit: null });
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    notifications.forEach(n => { if (n.type) types.add(n.type); });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (selectedType === 'all') return notifications;
    return notifications.filter(n => n.type === selectedType);
  }, [notifications, selectedType]);

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
        <div className="flex items-center gap-2">
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
            {typeIcons[type] || '🔔'} {typeLabels[type] || type}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Carregando notificacoes...
          </div>
        )}

        {!isLoading && filteredNotifications.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-semibold text-foreground">Nenhuma notificacao encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou aguarde novas notificacoes.</p>
          </div>
        )}

        {filteredNotifications.map(notification => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            onRead={markAsRead}
            onDelete={deleteNotification}
            onNavigate={handleNavigate}
          />
        ))}
      </div>
    </DashboardLayout>
  );
};

export default DashboardNotificationsPage;
