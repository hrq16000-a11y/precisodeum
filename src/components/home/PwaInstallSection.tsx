/**
 * PWA Install Section — Homepage CTA
 *
 * Aparece SOMENTE quando:
 *  - settings.enabled && settings.show_homepage_section
 *  - canInstall === true (beforeinstallprompt disparou)
 *  - !isStandalone (app não instalado)
 *  - usuário NÃO clicou em "fechar" recentemente (localStorage v2)
 *
 * Auto-oculta ao instalar (appinstalled) ou via PWA_HIDE_HOMEPAGE_EVENT.
 */
import { useEffect, useState } from 'react';
import { Download, Zap, Check, Star, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PWA_OPEN_INSTALL_MODAL_EVENT,
  usePwaInstallPrompt,
  usePwaSettings,
} from '@/hooks/usePwaInstall';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import playStoreIcon from '@/assets/play-store-icon.webp';

const HOMEPAGE_DISMISS_KEY = 'pwa_homepage_dismissed_v1';

const PwaInstallSection = () => {
  const { isStandalone, canInstall } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();
  const { data: siteData } = useSiteSettings();
  const [hidden, setHidden] = useState(() => {
    try {
      const ts = localStorage.getItem(HOMEPAGE_DISMISS_KEY);
      if (!ts) return false;
      // 7 dias de cooldown
      return Date.now() - Number(ts) < 7 * 86400000;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onInstalled = () => setHidden(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  if (!settings?.enabled) return null;
  if (!settings?.show_homepage_section) return null;
  if (isStandalone) return null;
  if (!canInstall) return null;
  if (hidden) return null;

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
          {/* Botão fechar — persiste por 7 dias */}
          <button
            onClick={() => {
              try { localStorage.setItem(HOMEPAGE_DISMISS_KEY, String(Date.now())); } catch {}
              setHidden(true);
            }}
            aria-label="Fechar convite de instalação"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-card/80 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
            {/* Left: icon + text — fontes maiores, mais respiro, layout limpo */}
            <div className="flex items-center gap-5 text-center md:text-left">
              <img
                src={playStoreIcon}
                alt="Disponível na Play Store"
                className="h-20 w-20 shrink-0 drop-shadow-md"
                loading="lazy"
                width={80}
                height={80}
              />
              <div>
                <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
                  {sectionTitle}
                </h2>
                <p className="mt-2 max-w-md text-base text-muted-foreground">
                  {sectionSubtitle}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground md:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-accent" /> Acesso rápido
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-accent" /> 100% gratuito
                  </span>
                </div>
              </div>
            </div>

            {/* Right: CTA — botão maior e mais legível */}
            <div className="flex w-full shrink-0 flex-col items-center gap-2 md:w-auto">
              <Button
                onClick={openInstallPopup}
                size="lg"
                className="w-full gap-2 rounded-xl bg-accent px-8 py-6 text-base font-bold text-accent-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl md:w-auto"
              >
                <Download className="h-5 w-5" />
                {sectionCta}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">Sem ocupar espaço no celular</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PwaInstallSection;
