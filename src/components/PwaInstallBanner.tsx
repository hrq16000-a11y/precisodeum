/**
 * PWA Install Banner — Popup modal central
 *
 * BLINDADO: Este componente é o ÚNICO popup de instalação.
 * Ele aparece automaticamente quando o app NÃO está instalado.
 * Pode ser reaberto via PWA_OPEN_INSTALL_MODAL_EVENT de qualquer CTA.
 *
 * REGRAS:
 * - Aparece SEMPRE (se não instalado), sem condição de beforeinstallprompt
 * - Fechar NUNCA trava a interface (closeModal limpa estado antes do await)
 * - Sem restrição por dispositivo
 * - Sem mensagens técnicas
 */
import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePwaInstallPrompt,
  usePwaSettings,
  trackPwaEvent,
  PWA_OPEN_INSTALL_MODAL_EVENT,
} from '@/hooks/usePwaInstall';

const PwaInstallBanner = () => {
  const [show, setShow] = useState(false);
  const [source, setSource] = useState<string>('banner');
  const { isStandalone, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  // Auto-show on mount (if not standalone)
  useEffect(() => {
    if (isStandalone) return;

    const timer = setTimeout(() => {
      setSource('banner');
      setShow(true);
      trackPwaEvent('impression', 'banner');
    }, 800);

    return () => clearTimeout(timer);
  }, [isStandalone]);

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
