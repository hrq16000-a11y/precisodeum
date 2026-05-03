/**
 * BackButton — botão "← Voltar" padronizado das fases do wizard.
 *
 * Comportamento:
 *  - Loading visual após o clique (Loader2 + texto "Voltando…").
 *  - Debounce: cliques múltiplos durante a transição são ignorados (300ms).
 *  - aria-busy quando processando.
 */
import { Loader2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface BackButtonProps {
  onBack: () => void;
  className?: string;
  label?: string;
}

export function BackButton({ onBack, className, label = 'Voltar' }: BackButtonProps) {
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  const handleClick = useCallback(() => {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    try {
      onBack();
    } finally {
      // Libera após 600ms — tempo suficiente para a transição da fase.
      setTimeout(() => {
        lockRef.current = false;
        setBusy(false);
      }, 600);
    }
  }, [onBack]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy}
      aria-label={busy ? 'Voltando para a etapa anterior' : 'Voltar para a etapa anterior'}
      className={
        className ??
        'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60'
      }
    >
      {busy ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Voltando…
        </>
      ) : (
        <>← {label}</>
      )}
    </button>
  );
}

export default BackButton;
