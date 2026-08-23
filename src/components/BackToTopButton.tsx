import { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * BackToTopButton
 * - Sempre montado (sem AnimatePresence) para reservar dimensões w-7 h-7
 *   e evitar contribuição ao CLS quando aparece no scroll.
 * - Animação puramente via CSS (opacity + transform), sem layout shift.
 * - Listener de scroll com throttle (rAF) e cleanup correto no unmount.
 */
const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);
  const tickingRef = useRef(false);

  useEffect(() => {
    const measure = () => {
      tickingRef.current = false;
      setVisible(window.scrollY > 400);
    };
    const handleScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      tickingRef.current = false;
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Voltar ao topo"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className="fixed right-3 z-40 flex h-7 w-7 items-center justify-center rounded-full bg-muted/80 text-muted-foreground backdrop-blur-xs shadow-xs transition-[opacity,transform] duration-200 ease-out hover:opacity-100 active:scale-95"
      style={{
        top: '60vh',
        width: '28px',
        height: '28px',
        opacity: visible ? 0.6 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.5)',
        pointerEvents: visible ? 'auto' : 'none',
        willChange: 'opacity, transform',
      }}
    >
      <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
};

export default BackToTopButton;
