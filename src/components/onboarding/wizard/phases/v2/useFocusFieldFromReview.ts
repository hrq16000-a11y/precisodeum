/**
 * Hook simples para destacar um campo após "Editar" do Review Step.
 *
 * Uso na fase de destino:
 *   const focused = useFocusFieldFromReview('bio');
 *   <textarea ref={focused.ref} className={focused.highlightClass} ... />
 */
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'onboarding-v2:focus-field';

export function setFocusFieldForNextPhase(field: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, field);
  } catch { /* ignore */ }
}

export function useFocusFieldFromReview(fieldName: string) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    let target: string | null = null;
    try { target = sessionStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (target !== fieldName) return;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }

    setHighlight(true);
    const id = setTimeout(() => {
      ref.current?.focus();
      try {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch { /* ignore */ }
    }, 120);
    const off = setTimeout(() => setHighlight(false), 2400);
    return () => { clearTimeout(id); clearTimeout(off); };
  }, [fieldName]);

  return {
    ref: ref as any,
    highlight,
    // Destaque "piscando" para chamar atenção do usuário ao campo que falta.
    // Combina ring vermelho + animate-pulse + sombra para máximo contraste,
    // sem depender de cores fora dos tokens.
    highlightClass: highlight
      ? 'ring-4 ring-destructive ring-offset-2 animate-pulse shadow-[0_0_24px_hsl(var(--destructive)/0.55)] transition-shadow'
      : '',
  };
}
