/**
 * PWA Install Section — Homepage CTA
 *
 * BLINDADO: Sempre visível na homepage.
 * Ao clicar, dispara PWA_OPEN_INSTALL_MODAL_EVENT para abrir o popup central.
 * Se já instalado (standalone), mostra "App instalado" desabilitado.
 */
import { Download, Smartphone, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PWA_OPEN_INSTALL_MODAL_EVENT,
  usePwaInstallPrompt,
  usePwaSettings,
} from '@/hooks/usePwaInstall';

const PwaInstallSection = () => {
  const { isStandalone } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  const sectionTitle = settings?.homepage_section_title || 'Tenha o app na palma da mão';
  const sectionSubtitle =
    settings?.homepage_section_subtitle ||
    'Instale gratuitamente e acesse profissionais, serviços e vagas com um toque.';
  const sectionCta = settings?.homepage_section_cta || 'Instalar Agora';

  const openInstallPopup = () => {
    if (isStandalone) return;
    window.dispatchEvent(
      new CustomEvent(PWA_OPEN_INSTALL_MODAL_EVENT, { detail: { source: 'homepage' } }),
    );
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{sectionTitle}</h2>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">{sectionSubtitle}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Acesso rápido
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> 100% gratuito
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" /> Instalação simples
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start md:items-center">
            {isStandalone ? (
              <Button size="sm" variant="secondary" disabled className="gap-2">
                <Check className="h-4 w-4" /> App instalado
              </Button>
            ) : (
              <Button onClick={openInstallPopup} size="sm" className="gap-2">
                <Download className="h-4 w-4" /> {sectionCta}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PwaInstallSection;
