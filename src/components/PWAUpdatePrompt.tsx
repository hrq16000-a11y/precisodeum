import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { DEFAULT_LOGO_PNG_SRCSET, DEFAULT_LOGO_SRCSET, DEFAULT_LOGO_URL } from '@/lib/siteAssets';

const UPDATE_COUNTDOWN_SECONDS = 5;
const RELOAD_FALLBACK_MS = 3000;

const PWAUpdatePrompt = () => {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(UPDATE_COUNTDOWN_SECONDS);
  const [reloading, setReloading] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const refreshingRef = useRef(false);
  const visibleRef = useRef(false);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    let mounted = true;
    let countdownId: number | undefined;
    let fallbackId: number | undefined;

    const reloadOnce = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };

    const applyUpdate = () => {
      if (!mounted || reloadingRef.current) return;
      reloadingRef.current = true;
      setReloading(true);
      waitingWorkerRef.current?.postMessage('SKIP_WAITING');
      fallbackId = window.setTimeout(reloadOnce, RELOAD_FALLBACK_MS);
    };

    const showUpdatePrompt = (worker: ServiceWorker) => {
      if (!mounted || visibleRef.current || refreshingRef.current) return;
      visibleRef.current = true;
      waitingWorkerRef.current = worker;
      setVisible(true);
      setCountdown(UPDATE_COUNTDOWN_SECONDS);

      countdownId = window.setInterval(() => {
        setCountdown((current) => {
          if (current <= 1) {
            window.clearInterval(countdownId);
            applyUpdate();
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    };

    const handleRegistration = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdatePrompt(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdatePrompt(installingWorker);
          }
        });
      });

      void registration.update().catch(() => undefined);
    };

    const handleControllerChange = () => {
      reloadOnce();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) handleRegistration(registration);
    });

    return () => {
      mounted = false;
      if (countdownId) window.clearInterval(countdownId);
      if (fallbackId) window.clearTimeout(fallbackId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const progress = reloading ? 100 : ((UPDATE_COUNTDOWN_SECONDS - countdown) / UPDATE_COUNTDOWN_SECONDS) * 100;
  const circleRadius = 58;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleOffset = circleCircumference - (progress / 100) * circleCircumference;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-background/80 p-5 backdrop-blur-md"
          role="alertdialog"
          aria-modal="true"
          aria-label="Atualização do aplicativo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            initial={{ opacity: 0, y: 36, scale: 0.88, rotateX: 10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 18, scale: 0.94, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 170, damping: 18, mass: 0.9 }}
          >
            <div className="h-1.5 w-full bg-muted">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>

            <div className="flex flex-col items-center px-6 py-8 text-center">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 132 132" aria-hidden="true">
                  <defs>
                    <linearGradient id="pwa-update-ring" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--accent))" />
                    </linearGradient>
                  </defs>
                  <circle cx="66" cy="66" r={circleRadius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                  <motion.circle
                    cx="66"
                    cy="66"
                    r={circleRadius}
                    fill="none"
                    stroke="url(#pwa-update-ring)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circleCircumference}
                    animate={{ strokeDashoffset: circleOffset }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                </svg>
                <picture>
                  <source type="image/webp" srcSet={DEFAULT_LOGO_SRCSET} sizes="96px" />
                  <img
                    src={DEFAULT_LOGO_URL}
                    srcSet={DEFAULT_LOGO_PNG_SRCSET}
                    sizes="96px"
                    alt="Preciso de um Profissional"
                    className="h-20 w-20 object-contain"
                    width="96"
                    height="96"
                    loading="eager"
                    decoding="async"
                  />
                </picture>
                <motion.div
                  className="absolute right-2 top-3 rounded-full bg-accent p-2 text-accent-foreground shadow-lg"
                  animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </motion.div>
              </div>

              <p className="mt-5 text-lg font-bold text-foreground">
                {reloading ? 'Recarregando... Aguarde um momento' : `Atualizando... Aplicando melhorias em ${countdown}s`}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAUpdatePrompt;