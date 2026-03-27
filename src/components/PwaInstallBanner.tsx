import { useState, useEffect, useCallback } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePwaInstallPrompt,
  usePwaSettings,
  trackPwaEvent,
  PWA_OPEN_INSTALL_MODAL_EVENT,
} from '@/hooks/usePwaInstall';

const DISMISS_KEY_BANNER = 'pwa_banner_dismissed_v3';
const COOLDOWN_MS = 3 * 86400000; // 3 days

type OpenModalDetail = {
  source?: string;
};

const PwaInstallBanner = () => {
  const [show, setShow] = useState(false);
  const [source, setSource] = useState<'banner' | 'homepage' | 'footer'>('banner');
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  const isDismissedLocally = useCallback(() => {
    try {
      const ts = localStorage.getItem(DISMISS_KEY_BANNER);
      if (!ts) return false;
      return Date.now() - Number(ts) < COOLDOWN_MS;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (isStandalone || !canInstall || isDismissedLocally()) return;

    const timer = setTimeout(() => {
      setSource('banner');
      setShow(true);
      trackPwaEvent('impression', 'banner');
    }, 800);

    return () => clearTimeout(timer);
  }, [isStandalone, canInstall, isDismissedLocally]);

  useEffect(() => {
    const onManualOpen = (evt: Event) => {
      const customEvent = evt as CustomEvent<OpenModalDetail>;
      const incomingSource = customEvent.detail?.source;
      if (incomingSource === 'homepage' || incomingSource === 'footer' || incomingSource === 'banner') {
        setSource(incomingSource);
      } else {
        setSource('banner');
      }
      setShow(true);
    };

    window.addEventListener(PWA_OPEN_INSTALL_MODAL_EVENT, onManualOpen as EventListener);
    return () => window.removeEventListener(PWA_OPEN_INSTALL_MODAL_EVENT, onManualOpen as EventListener);
  }, []);

  const closeModal = () => {
    setShow(false);
  };

  const handleInstall = async () => {
    closeModal();
    await install(source);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY_BANNER, String(Date.now()));
    } catch {
      // no-op
    }
    trackPwaEvent('dismissed', source);
    closeModal();
  };

  if (!show || isStandalone) return null;

  const titleText = settings?.title || 'Instale o App';
  const subtitleText = settings?.subtitle || 'Acesse mais rápido direto da tela inicial';
  const ctaText = settings?.cta_text || 'Instalar';
  const dismissText = settings?.dismiss_text || 'Agora não';

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instalação do aplicativo"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleDismiss}
        aria-label="Fechar chamada de instalação"
      />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-lg">
            <Download className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold leading-tight text-foreground">{titleText}</p>
            <p className="mt-1 text-sm font-medium leading-tight text-muted-foreground">{subtitleText}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">
          <Button
            size="lg"
            className="w-full bg-accent text-base font-bold text-accent-foreground shadow-lg hover:bg-accent/90"
            onClick={handleInstall}
          >
            <Download className="mr-2 h-5 w-5" />
            {ctaText}
          </Button>
        </div>

        <button
          onClick={handleDismiss}
          className="mt-3 w-full py-1 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {dismissText}
        </button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
