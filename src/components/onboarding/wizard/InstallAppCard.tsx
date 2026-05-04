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
import { Smartphone, Download, CheckCircle2 } from 'lucide-react';
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
  /**
   * Quando true, renderiza o card mesmo se o app já estiver em modo standalone
   * (mostra confirmação "App instalado"). Útil em telas de celebração onde
   * o card precisa ser visível independentemente de PC ou celular.
   */
  alwaysShow?: boolean;
}

export default function InstallAppCard({
  source = 'wizard-celebration',
  variant = 'card',
  alwaysShow = false,
}: Props) {
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();

  if (isStandalone && !alwaysShow) return null;

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

  const button = isStandalone ? (
    <div
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-700"
      aria-label="App já instalado"
    >
      <CheckCircle2 className="h-4 w-4" />
      App instalado
    </div>
  ) : (
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

  const title = isStandalone
    ? 'App instalado neste dispositivo'
    : 'Instale o app para receber clientes mais rápido';
  const subtitle = isStandalone
    ? 'Você já recebe notificações em tempo real. Compartilhe com sua equipe para instalarem também.'
    : 'Notificações em tempo real e acesso pela tela inicial — sem ocupar memória.';

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="font-display text-sm font-bold text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
          {button}
        </div>
      </div>
    </div>
  );
}
