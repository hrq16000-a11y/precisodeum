import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Sparkles, X, Share2, PlusSquare, Monitor, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstall';

const DISMISS_KEY = 'dashboard_pwa_nudge_dismissed';

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * CTA fixo de instalação do app dentro do Dashboard.
 * Fica sempre acessível em mobile e desktop; quando o prompt nativo não existe,
 * abre instruções claras para iPhone, Android e computador.
 *
 * Este componente é independente do banner global PwaInstallBanner — ele
 * fala diretamente com o público "profissional já logado", focando no
 * incentivo de pontos.
 */
const DashboardPwaInstallNudge = () => {
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();
  const [showHelper, setShowHelper] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  // Re-checa após hidratação
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (isStandalone || dismissed) return null;
  const ios = isIosDevice();

  const handleInstall = async () => {
    if (canInstall) {
      await install('dashboard_nudge_fixed');
      return;
    }
    setShowHelper(true);
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
          className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2rem)] max-w-xs overflow-hidden rounded-xl border border-primary/30 bg-background/95 p-4 shadow-lg backdrop-blur"
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
                <span>Alertas de leads instantâneos</span>
              </div>
              <h3 className="mt-1 text-sm font-bold leading-tight">
                Instale o app e receba o "bip" de novos leads em tempo real
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                Notificação na tela de bloqueio + som de alerta + bônus de +30 pontos de visibilidade.
              </p>
              <Button
                size="sm"
                onClick={handleInstall}
                className="mt-3 w-full"
              >
                {canInstall ? <Download className="mr-1.5 h-4 w-4" /> : <Smartphone className="mr-1.5 h-4 w-4" />}
                {canInstall ? 'Instalar App agora' : 'Como instalar o app'}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={showHelper} onOpenChange={setShowHelper}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Instalar o app
            </DialogTitle>
            <DialogDescription>
              Use o jeito mais rápido para o seu dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">iPhone</p>
              <ol className="mt-2 space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Share2 className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  Toque em <span className="font-medium text-foreground">Compartilhar</span> no Safari.
                </li>
                <li className="flex items-start gap-2">
                  <PlusSquare className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  Escolha <span className="font-medium text-foreground">Adicionar à Tela de Início</span>.
                </li>
              </ol>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">Android</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Abra o menu do navegador e toque em <span className="font-medium text-foreground">Instalar app</span> ou <span className="font-medium text-foreground">Adicionar à tela inicial</span>.
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold flex items-center gap-2"><Monitor className="h-4 w-4 text-primary" /> Computador</p>
              <p className="mt-2 text-xs text-muted-foreground">
                No Chrome ou Edge, clique no ícone de instalação na barra de endereço ou abra o menu do navegador e escolha <span className="font-medium text-foreground">Instalar app</span>.
              </p>
            </div>

            {ios ? null : canInstall ? (
              <Button onClick={() => void install('dashboard_helper_modal')} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Abrir instalador agora
              </Button>
            ) : null}
          </div>

          <Button onClick={() => setShowHelper(false)} className="mt-2 w-full" variant="outline">
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardPwaInstallNudge;
