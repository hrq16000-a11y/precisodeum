/**
 * AutoSaveBadge — selo discreto que comunica ao usuário que o wizard
 * salva automaticamente. Some após 4s de inatividade do estado.
 *
 * Também escuta os eventos globais `onboarding:remote-flush:start/end`
 * disparados por `flushRemoteDraft` para mostrar "Salvando…" durante
 * persistências remotas em rede lenta — feedback essencial pro usuário
 * entender o que está acontecendo ao clicar Voltar.
 */
import { useEffect, useState } from 'react';
import { Cloud, Check, Loader2 } from 'lucide-react';

interface AutoSaveBadgeProps {
  /** Qualquer dependência cuja mudança signifique "novo dado para salvar". */
  signal: unknown;
  /** Duração do estado "salvando" antes de virar "salvo". */
  savingMs?: number;
}

export const AutoSaveBadge = ({ signal, savingMs = 700 }: AutoSaveBadgeProps) => {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [remoteFlushing, setRemoteFlushing] = useState(false);

  useEffect(() => {
    setState('saving');
    const t1 = window.setTimeout(() => setState('saved'), savingMs);
    const t2 = window.setTimeout(() => setState('idle'), savingMs + 3500);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [signal, savingMs]);

  useEffect(() => {
    const onStart = () => setRemoteFlushing(true);
    const onEnd = () => setRemoteFlushing(false);
    window.addEventListener('onboarding:remote-flush:start', onStart);
    window.addEventListener('onboarding:remote-flush:end', onEnd);
    return () => {
      window.removeEventListener('onboarding:remote-flush:start', onStart);
      window.removeEventListener('onboarding:remote-flush:end', onEnd);
    };
  }, []);

  if (remoteFlushing || state === 'saving') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
        <Check className="h-3 w-3" /> Salvo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
      <Cloud className="h-3 w-3" /> Auto-save ativo
    </span>
  );
};

export default AutoSaveBadge;
