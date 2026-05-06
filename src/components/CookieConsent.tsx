import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const COOKIE_KEY = 'cookie_consent_accepted';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(COOKIE_KEY);
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] border-t border-border bg-card/95 backdrop-blur-lg p-4 shadow-lg md:bottom-0"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)' }}
    >
      <div className="container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Usamos cookies para melhorar sua experiência. Você pode aceitar todos os cookies ou configurar suas preferências em nossa{' '}
          <Link to="/privacidade" className="font-medium text-accent hover:underline">Política de Privacidade</Link>.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={decline}>
            Rejeitar
          </Button>
          <Button variant="accent" size="sm" onClick={accept}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
