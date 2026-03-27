import { Download, Check } from 'lucide-react';
import { usePwaInstallPrompt, usePwaSettings } from '@/hooks/usePwaInstall';

const PwaFooterInstall = () => {
  const { isStandalone, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const footerCta = settings?.footer_cta_text || 'Instalar App';

  const handleClick = async () => {
    if (isStandalone) return;
    await install('footer');
  };

  return (
    <div className="mt-4 border-t border-primary-foreground/10 pt-4">
      <button
        onClick={handleClick}
        className="mx-auto flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition-colors hover:bg-accent/90 disabled:cursor-default disabled:bg-primary-foreground/20 disabled:text-primary-foreground/80"
        disabled={isStandalone}
      >
        {isStandalone ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        {isStandalone ? 'App instalado' : footerCta}
      </button>
    </div>
  );
};

export default PwaFooterInstall;
