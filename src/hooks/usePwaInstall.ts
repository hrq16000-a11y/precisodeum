import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STANDALONE_AWARDED_KEY = 'pwa_install_mission_awarded';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  // Outros
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

/**
 * Hook único para PWA install:
 * - captura beforeinstallprompt
 * - detecta standalone e dispara missão (+30 pts) uma vez
 * - expõe promptInstall() para o banner
 */
export function usePwaInstall(userId: string | undefined) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(detectStandalone());
  const [installed, setInstalled] = useState<boolean>(false);
  const missionFiredRef = useRef(false);

  // 1) Capturar evento de instalação (Chromium)
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      // Audita aceite (funciona offline também — fire and forget)
      supabase.rpc('log_pwa_install_event', { _event: 'install_accepted', _meta: {} }).then(() => {});
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 2) Detectar standalone reativo (em caso de mudança)
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (!mq) return;
    const handler = () => setIsStandalone(detectStandalone());
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // 3) Quando standalone + logado → completar missão UMA vez
  useEffect(() => {
    if (!userId || !isStandalone || missionFiredRef.current) return;
    const sessionKey = `${STANDALONE_AWARDED_KEY}_${userId}`;
    if (localStorage.getItem(sessionKey) === '1') {
      missionFiredRef.current = true;
      return;
    }
    missionFiredRef.current = true;
    (async () => {
      // Audita abertura standalone
      supabase.rpc('log_pwa_install_event', { _event: 'standalone_opened', _meta: {} }).then(() => {});
      const { data, error } = await supabase.rpc('complete_app_install_mission');
      if (error) {
        missionFiredRef.current = false;
        return;
      }
      localStorage.setItem(sessionKey, '1');
      const result = data as { status?: string; points_awarded?: number } | null;
      if (result?.status === 'granted') {
        toast.success('App instalado! +30 pontos de visibilidade ganhos!', {
          description: 'Você desbloqueou a missão "App no Bolso".',
          duration: 6000,
        });
      }
    })();
  }, [userId, isStandalone]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' as const };
    supabase.rpc('log_pwa_install_event', { _event: 'install_prompted', _meta: {} }).then(() => {});
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'dismissed') {
      supabase.rpc('log_pwa_install_event', { _event: 'install_dismissed', _meta: {} }).then(() => {});
    }
    setDeferredPrompt(null);
    return { outcome: choice.outcome };
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt,
    isStandalone,
    isIos: isIos(),
    installed,
    promptInstall,
  };
}
