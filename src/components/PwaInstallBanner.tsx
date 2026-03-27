import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent, useIsMobileDevice } from '@/hooks/usePwaInstall';
import { useAuth } from '@/hooks/useAuth';

const PwaInstallBanner = () => {
  const [show, setShow] = useState(false);
  const { canInstall, isStandalone, isIos, install, dismiss, isDismissed, getVisitCount, getImpressionCount, incrementImpressions } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const { user } = useAuth();
  const isMobile = useIsMobileDevice();

  useEffect(() => {
    if (isStandalone || !settings?.enabled || !settings?.show_floating_banner) return;

    // Device check
    if (isMobile && !settings.show_on_mobile) return;
    if (!isMobile && !settings.show_on_desktop) return;

    // User type check
    if (user && !settings.show_for_logged_in) return;
    if (!user && !settings.show_for_visitors) return;

    // Dismiss cooldown
    if (isDismissed(settings.dismiss_cooldown_days)) return;

    // Max impressions
    if (settings.max_impressions > 0 && getImpressionCount() >= settings.max_impressions) return;

    // Need either canInstall (Android/desktop) or isIos
    if (!canInstall && !isIos) return;

    const visits = getVisitCount();
    if (visits < settings.min_visits) return;

    const timer = setTimeout(() => {
      setShow(true);
      incrementImpressions();
      trackPwaEvent('impression', 'banner');
    }, settings.show_delay_seconds * 1000);

    return () => clearTimeout(timer);
  }, [canInstall, isIos, isStandalone, settings, user, isMobile]);

  const handleInstall = async () => {
    if (isIos) return; // iOS shows instructions
    const result = await install('banner');
    if (result) setShow(false);
  };

  const handleDismiss = () => {
    dismiss('banner');
    setShow(false);
  };

  if (!show || !settings) return null;

  return (
    <div
      className="fixed bottom-[70px] left-3 right-3 z-[9990] rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-6 md:left-auto md:right-6 md:max-w-sm animate-in slide-in-from-bottom-4"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{settings.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{settings.subtitle}</p>
        </div>
        <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isIos ? (
        <div className="mt-3 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-xs text-foreground font-medium mb-2">
            <Share className="h-4 w-4 text-accent" />
            Como instalar no iPhone/iPad:
          </div>
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">1</span>
              Toque no ícone <Share className="inline h-3 w-3 mx-0.5" /> de compartilhar
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">2</span>
              Role e toque em <Plus className="inline h-3 w-3 mx-0.5" /> "Adicionar à Tela de Início"
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">3</span>
              Confirme tocando em "Adicionar"
            </li>
          </ol>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button variant="accent" size="sm" className="flex-1" onClick={handleInstall}>
            {settings.cta_text}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            {settings.dismiss_text}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PwaInstallBanner;
