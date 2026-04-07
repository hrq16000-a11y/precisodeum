/**
 * PWA Install Section — Homepage CTA
 *
 * Respeita show_homepage_section da tabela pwa_install_settings.
 * Ao clicar, dispara PWA_OPEN_INSTALL_MODAL_EVENT para abrir o popup central.
 */
import { Download, Zap, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PWA_OPEN_INSTALL_MODAL_EVENT,
  usePwaInstallPrompt,
  usePwaSettings,
} from '@/hooks/usePwaInstall';
import playStoreIcon from '@/assets/play-store-icon.png';

const PwaInstallSection = () => {
  const { isStandalone } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  if (!settings?.enabled) return null;
  if (!settings?.show_homepage_section) return null;

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
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/5 p-6 shadow-card md:p-8">
          {/* Decorative background */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
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
            <div className="flex shrink-0 flex-col items-center gap-2">
              {isStandalone ? (
                <Button size="lg" variant="secondary" disabled className="gap-2 rounded-xl">
                  <Check className="h-5 w-5" /> App instalado
                </Button>
              ) : (
                <Button onClick={openInstallPopup} size="lg" className="gap-2 rounded-xl px-6 shadow-lg">
                  <img src={playStoreIcon} alt="" className="h-5 w-5" />
                  {sectionCta}
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
