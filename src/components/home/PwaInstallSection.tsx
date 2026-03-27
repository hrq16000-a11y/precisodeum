import { Download, Smartphone, Zap, Share, Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt, usePwaSettings, trackPwaEvent } from '@/hooks/usePwaInstall';

const PwaInstallSection = () => {
  const { canInstall, isStandalone, isIos, install } = usePwaInstallPrompt();
  const { data: settings } = usePwaSettings();

  const sectionTitle = settings?.homepage_section_title || 'Tenha o app na palma da mão';
  const sectionSubtitle = settings?.homepage_section_subtitle || 'Instale gratuitamente e acesse profissionais, serviços e vagas com um toque.';
  const sectionCta = settings?.homepage_section_cta || 'Instalar Agora';

  if (isStandalone) return null;

  const handleInstall = async () => {
    trackPwaEvent('cta_click', 'homepage');
    await install('homepage');
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
              <h2 className="text-sm font-semibold text-foreground">
                {sectionTitle}
              </h2>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                {sectionSubtitle}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Acesso rápido
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  100% gratuito
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  Sem ocupar espaço
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start md:items-center">
            {isIos ? (
              <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                <Share className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Toque em <Share className="inline h-3 w-3" /> compartilhar → <Plus className="inline h-3 w-3" /> "Tela de Início"
                </span>
              </div>
            ) : canInstall ? (
              <Button
                onClick={handleInstall}
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {sectionCta}
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                <MoreVertical className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  Use o menu do navegador (<MoreVertical className="inline h-3 w-3" />) → <strong>"Instalar app"</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PwaInstallSection;
