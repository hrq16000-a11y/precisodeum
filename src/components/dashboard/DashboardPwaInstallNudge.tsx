import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Sparkles, X, Share2, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstall';
import { useIsMobile } from '@/hooks/use-mobile';

const DISMISS_KEY = 'dashboard_pwa_nudge_dismissed';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Banner de instalação do app dentro do Dashboard (apenas mobile).
 * Persuade o profissional a instalar o PWA prometendo +30 pts ao abrir
 * pela tela inicial. iOS recebe um modal helper de 2 passos.
 *
 * Este componente é independente do banner global PwaInstallBanner — ele
 * fala diretamente com o público "profissional já logado", focando no
 * incentivo de pontos.
 */
const DashboardPwaInstallNudge = () => {
  const isMobile = useIsMobile();
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();
  const [showIosHelper, setShowIosHelper] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  // Re-checa após hidratação
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (!isMobile || isStandalone || dismissed) return null;
  const ios = isIosDevice();
  // Mostrar para iOS sempre (com helper) ou Android quando puder instalar
  if (!ios && !canInstall) return null;

  const handleInstall = async () => {
    if (ios) {
      setShowIosHelper(true);
      return;
    }
    await install('dashboard_nudge');
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 shadow-sm"
          role="region"
          aria-label="Instalar aplicativo"
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label="Dispensar"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" />
                <span>Missão exclusiva</span>
              </div>
              <h3 className="mt-1 text-sm font-bold leading-tight">
                Instale o App e ganhe +30 pontos de visibilidade
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                Acesse com 1 toque na tela inicial e fique online sem precisar abrir o navegador.
              </p>
              <Button
                size="sm"
                onClick={handleInstall}
                className="mt-3 w-full sm:w-auto"
              >
                <Smartphone className="mr-1.5 h-4 w-4" />
                Instalar App agora
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={showIosHelper} onOpenChange={setShowIosHelper}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Instalar no iPhone (2 passos)
            </DialogTitle>
            <DialogDescription>
              Como o iOS não permite instalar automaticamente, siga os passos abaixo:
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-4 mt-2">
            <li className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                1
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold flex items-center gap-1.5">
                  Toque em <Share2 className="h-4 w-4 inline text-blue-500" /> Compartilhar
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No menu inferior do Safari (a seta para cima dentro de um quadrado).
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                2
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold flex items-center gap-1.5">
                  Selecione <PlusSquare className="h-4 w-4 inline text-emerald-600" /> Adicionar à Tela de Início
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O ícone "Preciso de Um" aparecerá na sua tela inicial. Abra por ele e ganhe +30 pontos!
                </p>
              </div>
            </li>
          </ol>

          <Button onClick={() => setShowIosHelper(false)} className="mt-2">
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardPwaInstallNudge;
