import { Button } from '@/components/ui/button';
import { User, Sparkles, RotateCcw } from 'lucide-react';

interface DebugResetBarProps {
  profileTypeLabel: string;
  onAssistant: () => void;
  onReset: () => void;
}

/**
 * Barra superior do Dashboard com tipo de conta + atalhos
 * "Assistente" (wizard em modo revisão) e "Reiniciar" cadastro.
 * Extraído de DashboardPage.tsx — contrato visual preservado.
 */
const DebugResetBar = ({ profileTypeLabel, onAssistant, onReset }: DebugResetBarProps) => (
  <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-xs">
    <div className="flex items-center gap-2 text-[12px] text-foreground min-w-0">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
        <User className="h-3.5 w-3.5" />
      </div>
      <span className="truncate">
        Conta: <strong>{profileTypeLabel}</strong>
      </span>
    </div>
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="default"
        className="h-7 gap-1.5 px-2.5 text-[11px]"
        onClick={onAssistant}
        title="Abrir o Wizard em modo revisão — ver tudo, editar o que pode e continuar o que falta"
        aria-label="Assistente — abrir Wizard em modo revisão"
      >
        <Sparkles className="h-3 w-3" />
        Assistente
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={onReset}
        title="Reiniciar cadastro do zero"
      >
        <RotateCcw className="h-3 w-3" />
        Reiniciar
      </Button>
    </div>
  </div>
);

export default DebugResetBar;
