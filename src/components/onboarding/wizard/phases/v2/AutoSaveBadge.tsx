/**
 * AutoSaveBadge — selo discreto que comunica ao usuário que o wizard
 * salva automaticamente. Some após 4s de inatividade do estado.
 */
import { useEffect, useState } from 'react';
import { CloudCheck, Loader2 } from 'lucide-react';

interface AutoSaveBadgeProps {
  /** Qualquer dependência cuja mudança signifique "novo dado para salvar". */
  signal: unknown;
  /** Duração do estado "salvando" antes de virar "salvo". */
  savingMs?: number;
}

export const AutoSaveBadge = ({ signal, savingMs = 700 }: AutoSaveBadgeProps) => {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setState('saving');
    const t1 = window.setTimeout(() => setState('saved'), savingMs);
    const t2 = window.setTimeout(() => setState('idle'), savingMs + 3500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [signal, savingMs]);

  if (state === 'idle') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
        <CloudCheck className="h-3 w-3" /> Auto-save ativo
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
      <CloudCheck className="h-3 w-3" /> Salvo
    </span>
  );
};

export default AutoSaveBadge;
