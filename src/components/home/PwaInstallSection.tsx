import { Download, Smartphone, Zap, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent } from '@/hooks/usePwaInstall';

const PwaInstallSection = () => {
  const { canInstall, isStandalone, isIos, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  const sectionTitle = settings?.homepage_section_title || 'Tenha o app na palma da mão';
  const sectionSubtitle = settings?.homepage_section_subtitle || 'Instale gratuitamente e acesse profissionais, serviços e vagas com um toque.';
  const sectionCta = settings?.homepage_section_cta || 'Instalar Agora';

  // Only hide if already installed as standalone app
  if (isStandalone) return null;

  const handleInstall = async () => {
    trackPwaEvent('cta_click', 'homepage');
    await install('homepage');
  };

  return (
    <section className="py-10 md:py-14">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-8 md:p-12">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground shadow-lg md:h-24 md:w-24">
              <Smartphone className="h-10 w-10 md:h-12 md:w-12 text-accent" />
            </div>

            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-primary-foreground md:text-3xl">
                {sectionTitle}
              </h2>
              <p className="mt-2 text-sm text-primary-foreground/70 md:text-base max-w-lg">
                {sectionSubtitle}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-4 md:justify-start">
                <div className="flex items-center gap-2 text-xs text-primary-foreground/80">
                  <Zap className="h-4 w-4 text-accent" />
                  Acesso rápido
                </div>
                <div className="flex items-center gap-2 text-xs text-primary-foreground/80">
                  <Download className="h-4 w-4 text-accent" />
                  100% gratuito
                </div>
                <div className="flex items-center gap-2 text-xs text-primary-foreground/80">
                  <Smartphone className="h-4 w-4 text-accent" />
                  Sem ocupar espaço
                </div>
              </div>

              <div className="mt-6">
                {isIos ? (
                  <div className="inline-flex items-start gap-3 rounded-xl bg-primary-foreground/10 p-4 text-left">
                    <Share className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-primary-foreground">Para instalar no iOS:</p>
                      <p className="mt-1 text-xs text-primary-foreground/70">
                        Toque em <Share className="inline h-3 w-3" /> compartilhar → <Plus className="inline h-3 w-3" /> "Tela de Início"
                      </p>
                    </div>
                  </div>
                ) : canInstall ? (
                  <Button
                    onClick={handleInstall}
                    size="lg"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg gap-2 px-8"
                  >
                    <Download className="h-5 w-5" />
                    {sectionCta}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="bg-accent/80 text-accent-foreground shadow-lg gap-2 px-8 cursor-default"
                    disabled
                  >
                    <Download className="h-5 w-5" />
                    Abra no celular para instalar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PwaInstallSection;
