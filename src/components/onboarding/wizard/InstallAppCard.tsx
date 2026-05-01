/**
 * InstallAppCard — instalação imediata do app.
 *
 * Botão SEMPRE clicável e com ação direta:
 *  - Se `beforeinstallprompt` está disponível ⇒ chama prompt nativo (1 toque).
 *  - Senão (ex.: iOS Safari, navegador sem suporte) ⇒ abre o modal global
 *    do banner PWA via `PWA_OPEN_INSTALL_MODAL_EVENT`, que mostra a instrução
 *    "Compartilhar → Adicionar à Tela de Início" sem travar a UI.
 *  - Some sozinho quando o app já está instalado (display-mode: standalone).
 *
 * Usado nas telas de celebração do wizard (visível ao lado dos CTAs principais).
 */
import { Smartphone, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePwaInstallPrompt,
  PWA_OPEN_INSTALL_MODAL_EVENT,
  trackPwaEvent,
} from '@/hooks/usePwaInstall';

interface Props {
  /** Origem para telemetria de instalação (default: 'wizard-celebration'). */
  source?: string;
  /** Variante visual: 'card' (padrão) ou 'inline' (sem moldura, p/ usar dentro de outro card). */
  variant?: 'card' | 'inline';
}

export default function InstallAppCard({
  source = 'wizard-celebration',
  variant = 'card',
}: Props) {
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();

  if (isStandalone) return null;

  const handleClick = async () => {
    if (canInstall) {
      // Caminho rápido: prompt nativo, 1 toque, instala imediatamente.
      await install(source);
      return;
    }
    // Fallback (iOS / browsers sem beforeinstallprompt): abre o modal global
    // do banner — único lugar com a instrução "Compartilhar → Adicionar".
    trackPwaEvent('cta_click', source);
    try {
      window.dispatchEvent(
        new CustomEvent(PWA_OPEN_INSTALL_MODAL_EVENT, { detail: { source } }),
      );
    } catch {
      /* fail-soft */
    }
  };

  const button = (
    <Button
      type="button"
      onClick={handleClick}
      className="h-10 w-full gap-2 bg-primary font-semibold text-primary-foreground hover:opacity-95"
      aria-label="Instalar o app agora"
    >
      <Download className="h-4 w-4" />
      Instalar app agora
    </Button>
  );

  if (variant === 'inline') {
    // Sem moldura — para uso dentro do BetCardShell.
    return button;
  }

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="font-display text-sm font-bold text-foreground">
              Instale o app para receber clientes mais rápido
            </p>
            <p className="text-[11px] text-muted-foreground">
              Notificações em tempo real e acesso pela tela inicial — sem ocupar memória.
            </p>
          </div>
          {button}
        </div>
      </div>
    </div>
  );
}
