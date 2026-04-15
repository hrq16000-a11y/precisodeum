import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Settings, BellRing, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, usePushSubscription, type Notification } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

import { Mail, Star, Bell as BellIcon2, Briefcase, CheckCircle, MessageCircle } from 'lucide-react';

const typeIconMap: Record<string, React.ComponentType<any>> = {
  lead: Mail,
  review: Star,
  system: BellIcon2,
  job: Briefcase,
  approval: CheckCircle,
  message: MessageCircle,
};

const NotificationItem = ({
  notification,
  onRead,
  onDelete,
  onNavigate,
  index,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (link: string) => void;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0 }}
    transition={{ duration: 0.25, delay: index * 0.04 }}
    layout
    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
      notification.read
        ? 'border-border/40 bg-background'
        : 'border-accent/30 bg-accent/5'
    }`}
  >
    <span className="mt-0.5">{(() => { const Icon = typeIconMap[notification.type] || BellIcon2; return <Icon className="h-5 w-5 text-muted-foreground" />; })()}</span>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium leading-tight ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
        {notification.title}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
      {(notification as any).image_url && (
        <img src={(notification as any).image_url} alt="" className="mt-1.5 rounded-md max-h-24 object-cover" />
      )}
      {(notification as any).video_url && (
        <a href={(notification as any).video_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
          Ver vídeo
        </a>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground/70">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-1">
      {notification.link && (
        <button
          onClick={() => onNavigate(notification.link!)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Abrir"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
      {!notification.read && (
        <button
          onClick={() => onRead(notification.id)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-accent transition-colors"
          title="Marcar como lida"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={() => onDelete(notification.id)}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Excluir"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  </motion.div>
);

export const NotificationBell = () => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-xl"
          >
            <NotificationDropdown onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NotificationDropdown = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushSubscription();
  const [showSettings, setShowSettings] = useState(false);

  const handleNavigate = (link: string) => {
    onClose();
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else {
      navigate(link);
    }
  };

  if (showSettings) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Configurações</h3>
          <button onClick={() => setShowSettings(false)} className="text-xs text-accent hover:underline">Voltar</button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              {isSubscribed ? <BellRing className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Notificações Push</p>
                <p className="text-xs text-muted-foreground">
                  {permission === 'denied'
                    ? 'Bloqueado pelo navegador'
                    : isSubscribed
                    ? 'Ativadas'
                    : 'Desativadas'}
                </p>
              </div>
            </div>
            {permission !== 'denied' && (
              <Button
                size="sm"
                variant={isSubscribed ? 'outline' : 'default'}
                onClick={() => isSubscribed ? unsubscribe() : subscribe()}
              >
                {isSubscribed ? 'Desativar' : 'Ativar'}
              </Button>
            )}
          </div>
          {permission === 'denied' && (
            <p className="text-xs text-muted-foreground">
              As notificações foram bloqueadas. Para ativá-las, acesse as configurações do navegador.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          Notificações
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </h3>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Marcar todas como lidas"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Configurações"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
        {notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-8 text-center"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" />
            </motion.div>
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma notificação</p>
            <p className="mt-0.5 text-xs text-muted-foreground/60">Você está em dia!</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((n, i) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={handleNavigate}
                index={i}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
