/**
 * PWA Install Banner — Popup modal central
 *
 * BLINDADO: Este componente é o ÚNICO popup de instalação.
 * Respeita TODAS as configurações da tabela pwa_install_settings:
 * - enabled, show_delay_seconds, min_visits, max_impressions
 * - dismiss_cooldown_days, show_on_mobile/desktop
 * - show_for_logged_in/visitors, show_floating_banner
 *
 * Pode ser reaberto via PWA_OPEN_INSTALL_MODAL_EVENT de qualquer CTA.
 */
import { useState, useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePwaInstallPrompt,
  usePwaSettings,
  trackPwaEvent,
  PWA_OPEN_INSTALL_MODAL_EVENT,
} from '@/hooks/usePwaInstall';
import { useAuth } from '@/hooks/useAuth';

const PwaInstallBanner = () => {
  const [show, setShow] = useState(false);
  const [source, setSource] = useState<string>('banner');
  const autoShownRef = useRef(false);
  const {
    isStandalone,
    install,
    isDismissed,
    getVisitCount,
    getImpressionCount,
    incrementImpressions,
  } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const { user, loading: authLoading } = useAuth();

  // Auto-show respecting ALL settings + scroll 50% OR delay trigger
  useEffect(() => {
    if (isStandalone || autoShownRef.current || authLoading) return;
    if (!settings) return;

    // Global kill switch
    if (!settings.enabled) return;

    // show_floating_banner controls the auto-popup
    if (!settings.show_floating_banner) return;

    // Device check
    const isMobile = window.innerWidth < 768;
    if (isMobile && !settings.show_on_mobile) return;
    if (!isMobile && !settings.show_on_desktop) return;

    // Auth check
    const isLoggedIn = !!user;
    if (isLoggedIn && !settings.show_for_logged_in) return;
    if (!isLoggedIn && !settings.show_for_visitors) return;

    // Dismiss cooldown
    if (isDismissed(settings.dismiss_cooldown_days)) return;

    // Min visits
    const visits = getVisitCount();
    if (visits < settings.min_visits) return;

    // Max impressions (0 = unlimited)
    const impressions = getImpressionCount();
    if (settings.max_impressions > 0 && impressions >= settings.max_impressions) return;

    const triggerShow = () => {
      if (autoShownRef.current) return;
      autoShownRef.current = true;
      setSource('banner');
      setShow(true);
      incrementImpressions();
      trackPwaEvent('impression', 'banner');
    };

    // Trigger 1: Delay from settings (in seconds)
    const delayMs = (settings.show_delay_seconds || 5) * 1000;
    const timer = setTimeout(triggerShow, delayMs);

    // Trigger 2: Scroll past 50% of the page
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && scrollTop / docHeight >= 0.5) {
        triggerShow();
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [
    isStandalone, settings, authLoading, user,
    isDismissed, getVisitCount, getImpressionCount, incrementImpressions,
  ]);

  // Listen for manual open from CTAs (homepage section, footer button, etc.)
  useEffect(() => {
    const onManualOpen = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      setSource(detail?.source || 'banner');
      setShow(true);
    };

    window.addEventListener(PWA_OPEN_INSTALL_MODAL_EVENT, onManualOpen);
    return () => window.removeEventListener(PWA_OPEN_INSTALL_MODAL_EVENT, onManualOpen);
  }, []);

  // CRITICAL: close modal FIRST, then do async work
  const handleInstall = async () => {
    setShow(false);
    await install(source);
  };

  const handleDismiss = () => {
    setShow(false);
    // Persist dismiss with cooldown
    localStorage.setItem('pwa_install_dismissed_v2', String(Date.now()));
    trackPwaEvent('dismissed', source);
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
      {/* Backdrop — click to dismiss */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleDismiss}
        role="presentation"
      />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
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

        {/* Install CTA */}
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

        {/* Dismiss link */}
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
