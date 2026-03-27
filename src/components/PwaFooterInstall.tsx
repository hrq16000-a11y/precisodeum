import { Download, Check } from 'lucide-react';
import { usePwaInstallPrompt, usePwaSettings } from '@/hooks/usePwaInstall';

const PwaFooterInstall = () => {
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const footerCta = settings?.footer_cta_text || 'Instalar App';

  const handleClick = async () => {
    if (!canInstall || isStandalone) return;
    await install('footer');
  };

  return (
    <div className="mt-4 border-t border-primary-foreground/10 pt-4">
      {isStandalone ? (
        <div className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-primary-foreground/10 px-5 py-2.5 text-sm font-semibold text-primary-foreground/70">
          <Check className="h-4 w-4" />
          App instalado
        </div>
      ) : (
        <button
          onClick={handleClick}
          disabled={!canInstall}
          className="mx-auto flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-default"
        >
          <Download className="h-4 w-4" />
          {footerCta}
        </button>
      )}
    </div>
  );
};

export default PwaFooterInstall;
