import { Download, Share, Plus } from 'lucide-react';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent } from '@/hooks/usePwaInstall';

const PwaFooterInstall = () => {
  const { canInstall, isStandalone, isIos, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  if (isStandalone) return null;
  if (!settings?.enabled || !settings?.show_in_footer) return null;

  const handleClick = async () => {
    if (isIos) return;
    trackPwaEvent('cta_click', 'footer');
    await install('footer');
  };

  return (
    <div className="mt-4 border-t border-primary-foreground/10 pt-4">
      {isIos ? (
        <div className="flex items-center justify-center gap-2 text-xs text-primary-foreground/60">
          <Download className="h-4 w-4 text-accent" />
          <span>
            Instale o app: toque em <Share className="inline h-3 w-3" /> → <Plus className="inline h-3 w-3" /> "Tela de Início"
          </span>
        </div>
      ) : canInstall ? (
        <button
          onClick={handleClick}
          className="mx-auto flex items-center gap-2 rounded-lg bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
        >
          <Download className="h-4 w-4" />
          {settings.footer_cta_text}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 text-xs text-primary-foreground/60">
          <Download className="h-4 w-4 text-accent" />
          <span>Abra no navegador do celular para instalar o app</span>
        </div>
      )}
    </div>
  );
};

export default PwaFooterInstall;
