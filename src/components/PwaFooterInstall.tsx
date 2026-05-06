/**
 * PWA Footer Install — Rodapé CTA
 *
 * BLINDADO: Sempre visível no rodapé.
 * Ao clicar, dispara PWA_OPEN_INSTALL_MODAL_EVENT para abrir o popup central.
 * Se já instalado (standalone), mostra "App instalado".
 */
import { Download, Check } from 'lucide-react';
import {
  PWA_OPEN_INSTALL_MODAL_EVENT,
  usePwaInstallPrompt,
  usePwaSettings,
} from '@/hooks/usePwaInstall';

const PwaFooterInstall = () => {
  const { isStandalone } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const footerCta = settings?.footer_cta_text || 'Instalar App';

  const openInstallPopup = () => {
    if (isStandalone) return;
    window.dispatchEvent(
      new CustomEvent(PWA_OPEN_INSTALL_MODAL_EVENT, { detail: { source: 'footer' } }),
    );
  };

  return (
    <div className="mt-4 border-t border-primary-foreground/10 pt-4">
      {isStandalone ? (
        <div className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-primary-foreground/10 px-5 py-2.5 text-sm font-semibold text-primary-foreground/70">
          <Check className="h-4 w-4" /> App instalado
        </div>
      ) : (
        <button
          onClick={openInstallPopup}
          className="mx-auto flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition-colors hover:bg-accent/90"
        >
          <Download className="h-4 w-4" /> {footerCta}
        </button>
      )}
    </div>
  );
};

export default PwaFooterInstall;
