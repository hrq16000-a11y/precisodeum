import { Download, Share, Plus, MoreVertical } from 'lucide-react';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent } from '@/hooks/usePwaInstall';

const PwaFooterInstall = () => {
  const { canInstall, isStandalone, isIos, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const footerCta = settings?.footer_cta_text || 'Instalar App';

  if (isStandalone) return null;

  const handleClick = async () => {
    if (isIos) return;
    trackPwaEvent('cta_click', 'footer');
    await install('footer');
  };

  return (
    <div className="mt-4 border-t border-primary-foreground/10 pt-4">
      {isIos ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2.5 text-xs text-primary-foreground/70">
          <Download className="h-4 w-4 shrink-0 text-accent" />
          <span>
            Instale o app: toque em <Share className="inline h-3 w-3" /> → <Plus className="inline h-3 w-3" /> "Tela de Início"
          </span>
        </div>
      ) : canInstall ? (
        <button
          onClick={handleClick}
          className="mx-auto flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition-colors hover:bg-accent/90"
        >
          <Download className="h-4 w-4" />
          {footerCta}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-accent/20 px-3 py-2.5 text-xs text-primary-foreground/80">
          <MoreVertical className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-medium">
            Menu do navegador → "Instalar app"
          </span>
        </div>
      )}
    </div>
  );
};

export default PwaFooterInstall;
