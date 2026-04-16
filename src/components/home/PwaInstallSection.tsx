/**
 * PWA Install Section — Homepage CTA
 *
 * Respeita show_homepage_section da tabela pwa_install_settings.
 * Ao clicar, dispara PWA_OPEN_INSTALL_MODAL_EVENT para abrir o popup central.
 */
import { Download, Zap, Check, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PWA_OPEN_INSTALL_MODAL_EVENT,
  usePwaInstallPrompt,
  usePwaSettings,
} from '@/hooks/usePwaInstall';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import playStoreIcon from '@/assets/play-store-icon.png';

const PwaInstallSection = () => {
  const { isStandalone, canInstall } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const { data: siteData } = useSiteSettings();

  if (!settings?.enabled) return null;
  if (!settings?.show_homepage_section) return null;

  const sectionTitle = siteData?.values?.['pwa_section_title'] || settings?.homepage_section_title || 'Tenha o app na palma da mão';
  const sectionSubtitle = siteData?.values?.['pwa_section_subtitle'] || settings?.homepage_section_subtitle || 'Instale gratuitamente e acesse profissionais, serviços e vagas com um toque.';
  const sectionCta = siteData?.values?.['pwa_section_cta'] || settings?.homepage_section_cta || 'Baixar App';
  const ctaLink = siteData?.values?.['pwa_section_link'] || '';
  const bgColor = siteData?.values?.['pwa_section_bg'] || '';

  const openInstallPopup = () => {
    if (ctaLink) {
      window.open(ctaLink, '_blank', 'noopener');
      return;
    }
    if (isStandalone || !canInstall) return;
    window.dispatchEvent(
      new CustomEvent(PWA_OPEN_INSTALL_MODAL_EVENT, { detail: { source: 'homepage' } }),
    );
  };

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div
          className={`relative overflow-hidden rounded-3xl p-6 md:p-8 ${!bgColor ? 'bg-accent/5 border border-accent/10' : ''}`}
          style={bgColor ? { backgroundColor: bgColor } : undefined}
        >
          {/* Decorative background elements */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative flex flex-col items-center gap-5 md:flex-row md:justify-between">
            {/* Left: icon + text */}
            <div className="flex items-center gap-4 text-center md:text-left">
              <img
                src={playStoreIcon}
                alt="Disponível na Play Store"
                className="h-16 w-16 shrink-0 drop-shadow-md"
                loading="lazy"
                width={64}
                height={64}
              />
              <div>
                <h2 className="font-display text-lg font-bold text-foreground md:text-xl">
                  {sectionTitle}
                </h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {sectionSubtitle}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground md:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-accent" /> Acesso rápido
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5 text-accent" /> 100% gratuito
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-accent" /> 4.8 ★
                  </span>
                </div>
              </div>
            </div>

            {/* Right: CTA */}
            <div className="flex w-full shrink-0 flex-col items-center gap-2 md:w-auto">
              {isStandalone ? (
                <Button size="lg" variant="secondary" disabled className="w-full gap-2 rounded-xl md:w-auto">
                  <Check className="h-5 w-5" /> App instalado
                </Button>
              ) : (
                <Button
                  onClick={openInstallPopup}
                  size="lg"
                  className="w-full gap-2 rounded-xl bg-accent px-8 text-accent-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl md:w-auto"
                >
                  <Download className="h-5 w-5" />
                  {sectionCta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <span className="text-[10px] text-muted-foreground">Sem ocupar espaço no celular</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PwaInstallSection;
