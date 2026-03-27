import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent, useIsMobileDevice } from '@/hooks/usePwaInstall';
import { useAuth } from '@/hooks/useAuth';

const PwaInstallBanner = () => {
  const [show, setShow] = useState(false);
  const { canInstall, isStandalone, isIos, install, dismiss, isDismissed, getImpressionCount, incrementImpressions } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const { user } = useAuth();
  const isMobile = useIsMobileDevice();

  const compactText = (value: string | undefined, fallback: string, maxWords: number) =>
    (value?.trim() || fallback).split(/\s+/).slice(0, maxWords).join(' ');

  const titleText = compactText(settings?.title, 'Instale o App', 3);
  const subtitleText = compactText(settings?.subtitle, 'Mais rápido', 3);
  const ctaText = compactText(settings?.cta_text, 'Instalar', 2);

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

    // Show for all users - the CTA will adapt based on capability

    const effectiveDelaySeconds = Math.min(settings.show_delay_seconds, 1);

    const timer = setTimeout(() => {
      setShow(true);
      incrementImpressions();
      trackPwaEvent('impression', 'banner');
    }, effectiveDelaySeconds * 1000);

    return () => clearTimeout(timer);
  }, [canInstall, isIos, isStandalone, settings, user, isMobile]);

  const handleInstall = async () => {
    if (isIos) return;
    if (canInstall) {
      const result = await install('banner');
      if (result) setShow(false);
    }
  };

  const handleDismiss = () => {
    dismiss('banner');
    setShow(false);
  };

  if (!show || !settings) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-end justify-center p-4 pb-28 md:items-center md:pb-6"
      role="dialog"
      aria-modal="true"
      aria-label="Instalação do aplicativo"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleDismiss}
        aria-label="Fechar chamada de instalação"
      />

      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-enter"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent pulse">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold leading-tight text-foreground">{titleText}</p>
            <p className="mt-1 text-sm font-medium leading-tight text-muted-foreground">{subtitleText}</p>
          </div>
          <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isIos ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Share className="h-4 w-4 text-accent" />
              Instalação no iPhone
            </div>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">1</span>
                Toque em <Share className="mx-0.5 inline h-3 w-3" /> compartilhar
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold">2</span>
                Escolha <Plus className="mx-0.5 inline h-3 w-3" /> Tela de Início
              </li>
            </ol>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <Button
              size="lg"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleInstall}
            >
              {canInstall ? ctaText : 'Instalar'}
            </Button>
            {!canInstall && (
              <p className="text-center text-xs text-muted-foreground">
                No celular, toque em instalar.
              </p>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={handleDismiss}>
              {settings.dismiss_text}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PwaInstallBanner;
