import { useState, useEffect } from 'react';

/**
 * Cinematic split-curtain reveal overlay that plays once per session.
 * Only shows for standalone PWA mode (installed app), never on browser.
 */
const SESSION_KEY = 'curtain_played';

const isStandalone = () => {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
};

const CurtainReveal = () => {
  const [show, setShow] = useState(() => {
    try {
      if (!isStandalone()) return false;
      return !sessionStorage.getItem(SESSION_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* silent */ }
    const timer = setTimeout(() => setShow(false), 1200);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;

  return (
    <div className="curtain-reveal pointer-events-none fixed inset-0 z-[9998]" aria-hidden>
      <div className="curtain-left absolute inset-y-0 left-0 w-1/2 bg-primary" />
      <div className="curtain-right absolute inset-y-0 right-0 w-1/2 bg-primary" />
      <div className="entrance-sweep absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent" />
    </div>
  );
};

export default CurtainReveal;
