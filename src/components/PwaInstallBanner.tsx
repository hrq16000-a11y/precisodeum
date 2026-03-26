import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DAYS = 7;
const VISIT_KEY = 'pwa_visit_count';

const PwaInstallBanner = () => {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Don't show if already installed (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check dismiss
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 86400000) return;

    // Track visits
    const visits = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
    localStorage.setItem(VISIT_KEY, String(visits));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after 2nd visit or 30s on first
      if (visits >= 2) {
        setShow(true);
      } else {
        setTimeout(() => setShow(true), 30000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-[70px] left-3 right-3 z-[9990] rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-4 md:left-auto md:right-4 md:max-w-sm animate-in slide-in-from-bottom-4"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Instale o app</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Acesse mais rápido direto da tela inicial</p>
        </div>
        <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="accent" size="sm" className="flex-1" onClick={install}>
          Instalar
        </Button>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Agora não
        </Button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
