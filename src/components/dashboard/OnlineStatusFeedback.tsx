import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useIsProviderOnline } from '@/hooks/useOnlinePresence';

/**
 * Quando o usuário sincroniza com o canal Presence pela primeira vez na sessão,
 * mostra:
 *  - mini-toast: "Você agora é prioridade nas buscas da sua região!"
 *  - badge pulsante verde abaixo do hero (curtinho, ~5s).
 *
 * Widget IMUTÁVEL — não é dispensável (alinhado com a regra `online_status`).
 */
const OnlineStatusFeedback = () => {
  const { user } = useAuth();
  const isOnline = useIsProviderOnline(user?.id);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || !isOnline || celebratedRef.current) return;
    celebratedRef.current = true;

    const sessionKey = `online_celebrated_${user.id}`;
    const alreadyCelebrated = sessionStorage.getItem(sessionKey);
    if (alreadyCelebrated) return;

    sessionStorage.setItem(sessionKey, '1');
    toast.success('Você agora é prioridade nas buscas da sua região!', {
      description: 'Status Online ativo — apareça primeiro para clientes próximos.',
      duration: 4500,
      icon: <Wifi className="h-4 w-4" />,
    });
  }, [user?.id, isOnline]);

  return (
    <AnimatePresence>
      {isOnline && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
          aria-label="Você está online e visível em buscas"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Online — prioridade nas buscas
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OnlineStatusFeedback;
