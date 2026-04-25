import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import {
  usePresenceVisibility,
  useIsProviderOnline,
} from '@/hooks/useOnlinePresence';
import { cn } from '@/lib/utils';

/**
 * Seletor online/offline persistente.
 * - Persiste em localStorage (`presence_visibility_<userId>`).
 * - usePresenceTracker reage automaticamente e (des)conecta o canal Presence.
 * - Os badges "Trabalhando agora" e "Ativo hoje" no card do provider
 *   atualizam em tempo real via realtime.
 */
const OnlineStatusToggle = () => {
  const { user, provider } = useAuth();
  const [visible, setVisible] = usePresenceVisibility(user?.id);
  const isOnline = useIsProviderOnline(user?.id);
  const [transitioning, setTransitioning] = useState(false);

  if (!provider?.id) return null;

  const handleToggle = (next: boolean) => {
    setVisible(next);
    setTransitioning(true);
    setTimeout(() => setTransitioning(false), 1500);
    if (next) {
      toast.success('Você está online!', {
        description: 'Aparecendo como "Trabalhando agora" para clientes próximos.',
      });
    } else {
      toast('Você ficou offline', {
        description: 'Continua aparecendo no ranking, mas sem badge de "Trabalhando agora".',
      });
    }
  };

  const showOnlineBadge = visible && isOnline;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        showOnlineBadge
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-border bg-card',
      )}
      role="region"
      aria-label="Controle de visibilidade online"
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          showOnlineBadge
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <AnimatePresence mode="wait">
          {transitioning ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </motion.span>
          ) : showOnlineBadge ? (
            <motion.span
              key="on"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="relative flex h-full w-full items-center justify-center"
            >
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-500 opacity-60" />
              <Wifi className="relative h-4 w-4" />
            </motion.span>
          ) : (
            <motion.span
              key="off"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
            >
              <WifiOff className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {showOnlineBadge ? 'Trabalhando agora' : visible ? 'Visível nas buscas' : 'Modo invisível'}
        </p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5">
          {showOnlineBadge
            ? 'Aparecendo no topo para clientes da sua região.'
            : visible
              ? 'Conectando para mostrar status em tempo real…'
              : 'Você não recebe novas buscas até reativar.'}
        </p>
      </div>

      <Switch
        checked={visible}
        onCheckedChange={handleToggle}
        aria-label={visible ? 'Ficar offline' : 'Ficar online'}
      />
    </div>
  );
};

export default OnlineStatusToggle;
