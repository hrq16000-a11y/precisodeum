/**
 * NotificationPermissionGate
 *
 * Solicita permissão de notificações Web Push em DOIS momentos:
 *  1) Ao acessar o /dashboard, após pequeno delay (não invasivo)
 *  2) Logo após instalação do PWA (evento `appinstalled`)
 *
 * Regras:
 *  - Só pergunta se a permissão atual for "default" (nunca já concedida/negada)
 *  - Mostra um banner discreto no topo do dashboard com CTA explícito
 *    (NUNCA dispara `Notification.requestPermission()` sem clique do usuário —
 *     navegadores bloqueiam prompts não-iniciados pelo usuário).
 *  - Persiste dispense em localStorage (`notif_perm_gate_dismissed`)
 */
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaNotifications } from '@/hooks/usePwaNotifications';
import { toast } from 'sonner';

const DISMISS_KEY = 'notif_perm_gate_dismissed_v1';
const DISMISS_DAYS = 7;

const isDismissed = () => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const markDismissed = () => {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
};

const NotificationPermissionGate = () => {
  const { isSupported, permission, subscribe, isLoading } = usePwaNotifications();
  const [show, setShow] = useState(false);
  const [trigger, setTrigger] = useState<'dashboard' | 'pwa-install'>('dashboard');

  useEffect(() => {
    if (!isSupported) return;
    if (permission !== 'default') return;
    if (isDismissed()) return;

    // Dashboard: revela após 1.5s para não ser invasivo
    const t = setTimeout(() => setShow(true), 1500);

    // PWA install: força mostrar imediatamente após app instalado
    const onAppInstalled = () => {
      setTrigger('pwa-install');
      setShow(true);
    };
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      clearTimeout(t);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [isSupported, permission]);

  if (!show) return null;

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      toast.success('Notificações ativadas!');
      setShow(false);
    } else {
      toast.error('Não foi possível ativar. Verifique as permissões do navegador.');
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label="Solicitação de permissão de notificações"
      className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/15 p-2">
          <Bell className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {trigger === 'pwa-install'
              ? 'App instalado! Ative as notificações'
              : 'Receba alertas em tempo real'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Avisamos sobre novos contatos, mensagens e oportunidades — você pode desativar a qualquer momento.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={isLoading}
              aria-label="Ativar notificações"
            >
              {isLoading ? 'Ativando...' : 'Ativar notificações'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              aria-label="Adiar pedido de notificações"
            >
              Agora não
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default NotificationPermissionGate;
