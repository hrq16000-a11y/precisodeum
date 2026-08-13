import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type RevealVariant = 'up' | 'fade' | 'scale';

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: 'motion-enter',
  fade: 'motion-enter-fade',
  scale: 'motion-enter-scale',
};

interface RevealProps {
  children: ReactNode;
  /** Estilo da entrada. Padrão: deslocamento vertical de 8px. */
  variant?: RevealVariant;
  /** Atraso em ms (útil para cascata manual). */
  delay?: number;
  /** Anima só quando entra na viewport (padrão) ou imediatamente. */
  onViewport?: boolean;
  className?: string;
  as?: ElementType;
}

/**
 * Entrada suave de qualquer bloco, disparada por IntersectionObserver.
 *
 * Motion principles:
 *  - 220ms / ease-out / deslocamento ≤ 8px → zero CLS perceptível;
 *  - anima uma única vez (sem "yo-yo" no scroll);
 *  - respeita `prefers-reduced-motion` (classes neutralizadas no index.css);
 *  - fallback: sem IntersectionObserver, o conteúdo aparece visível.
 */
const Reveal = ({
  children,
  variant = 'up',
  delay = 0,
  onViewport = true,
  className,
  as: Tag = 'div',
}: RevealProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(!onViewport);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '80px 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref as never}
      className={cn(visible ? VARIANT_CLASS[variant] : 'opacity-0', className)}
      style={visible && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
export { Reveal };
