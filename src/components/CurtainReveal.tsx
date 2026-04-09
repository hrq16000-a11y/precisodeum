import { useState, useEffect } from 'react';

/**
 * Cinematic split-curtain reveal overlay that plays once per session.
 * After the animation completes, the component unmounts entirely.
 */
const SESSION_KEY = 'curtain_played';

const CurtainReveal = () => {
  const [show, setShow] = useState(() => {
    try {
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
      {/* Left curtain */}
      <div className="curtain-left absolute inset-y-0 left-0 w-1/2 bg-primary" />
      {/* Right curtain */}
      <div className="curtain-right absolute inset-y-0 right-0 w-1/2 bg-primary" />
      {/* Shimmer sweep */}
      <div className="entrance-sweep absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent" />
    </div>
  );
};

export default CurtainReveal;
