/**
 * InstallAppCard — convite inline para instalar o PWA.
 *
 * Renderizado ao final da Fase 2 do Wizard (PhaseCelebration / Phase3Celebration)
 * para sugerir a instalação do app logo após o prestador publicar o 1º serviço.
 *
 * Regras (alinhadas ao módulo PWA blindado):
 *  - Não bloqueia o avanço do wizard.
 *  - Some sozinho quando o app já está instalado (display-mode: standalone).
 *  - Quando `beforeinstallprompt` não está disponível (iOS, browsers que não
 *    expõem o evento), exibe uma instrução discreta em vez do botão.
 */
import { Smartphone, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstall';

interface Props {
  /** Origem para telemetria de instalação (default: 'wizard-celebration'). */
  source?: string;
}

export default function InstallAppCard({ source = 'wizard-celebration' }: Props) {
  const { canInstall, isStandalone, install } = usePwaInstallPrompt();

  if (isStandalone) return null;

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
              Notificações em tempo real de novos pedidos e acesso pela tela inicial — sem ocupar memória.
            </p>
          </div>
          {canInstall ? (
            <Button
              type="button"
              size="sm"
              onClick={() => { void install(source); }}
              className="h-8 w-full bg-primary text-primary-foreground hover:opacity-95"
            >
              <Download className="mr-2 h-3.5 w-3.5" /> Instalar agora
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No iPhone: toque em <span className="font-semibold text-foreground">Compartilhar</span> → <span className="font-semibold text-foreground">Adicionar à Tela de Início</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
