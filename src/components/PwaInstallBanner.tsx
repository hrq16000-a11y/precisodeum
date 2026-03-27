import { useState, useEffect, useCallback } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent } from '@/hooks/usePwaInstall';

const DISMISS_KEY_BANNER = 'pwa_banner_dismissed_v3';
const COOLDOWN_MS = 3 * 86400000; // 3 days

const PwaInstallBanner = () => {
  const [show, setShow] = useState(false);
  const { canInstall, isStandalone, isIos, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  const isDismissedLocally = useCallback(() => {
    try {
      const ts = localStorage.getItem(DISMISS_KEY_BANNER);
      if (!ts) return false;
      return Date.now() - Number(ts) < COOLDOWN_MS;
    } catch { return false; }
  }, []);

  useEffect(() => {
    // Only hide if already installed as standalone
    if (isStandalone) return;
    if (isDismissedLocally()) return;

    // Show after a very short delay (animation entrance)
    const timer = setTimeout(() => {
      setShow(true);
      trackPwaEvent('impression', 'banner');
    }, 800);

    return () => clearTimeout(timer);
  }, [isStandalone, isDismissedLocally]);

  const handleInstall = async () => {
    if (canInstall) {
      const result = await install('banner');
      if (result) setShow(false);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY_BANNER, String(Date.now())); } catch {}
    trackPwaEvent('dismissed', 'banner');
    setShow(false);
  };

  if (!show) return null;

  const titleText = settings?.title || 'Instale o App';
  const subtitleText = settings?.subtitle || 'Mais rápido';
  const ctaText = settings?.cta_text || 'Instalar';
  const dismissText = settings?.dismiss_text || 'Agora não';

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instalação do aplicativo"
      style={{ isolation: 'isolate' }}
    >
      {/* Overlay escuro + blur */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleDismiss}
        aria-label="Fechar chamada de instalação"
      />

      {/* Card central */}
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-lg">
            <Download className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold leading-tight text-foreground">{titleText}</p>
            <p className="mt-1 text-sm font-medium leading-tight text-muted-foreground">{subtitleText}</p>
          </div>
          <button onClick={handleDismiss} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {isIos ? (
          <div className="mt-5 rounded-xl border border-border bg-muted/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Share className="h-4 w-4 text-accent" />
              Instalação no iPhone
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">1</span>
                Toque em <Share className="mx-0.5 inline h-3.5 w-3.5" /> compartilhar
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">2</span>
                Escolha <Plus className="mx-0.5 inline h-3.5 w-3.5" /> Tela de Início
              </li>
            </ol>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <Button
              size="lg"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-base font-bold shadow-lg"
              onClick={handleInstall}
            >
              <Download className="mr-2 h-5 w-5" />
              {canInstall ? ctaText : 'Instalar'}
            </Button>
            {!canInstall && (
              <p className="text-center text-xs text-muted-foreground">
                Abra no navegador do celular para instalar.
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleDismiss}
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {dismissText}
        </button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
