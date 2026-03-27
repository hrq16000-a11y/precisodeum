import { Download } from 'lucide-react';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent } from '@/hooks/usePwaInstall';

const PwaFooterInstall = () => {
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const footerCta = settings?.footer_cta_text || 'Instalar App';

  // Hide if already installed or if install is not available
  if (isStandalone || !canInstall) return null;

  const handleClick = async () => {
    trackPwaEvent('cta_click', 'footer');
    await install('footer');
  };

  return (
    <div className="mt-4 border-t border-primary-foreground/10 pt-4">
      <button
        onClick={handleClick}
        className="mx-auto flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition-colors hover:bg-accent/90"
      >
        <Download className="h-4 w-4" />
        {footerCta}
      </button>
    </div>
  );
};

export default PwaFooterInstall;
