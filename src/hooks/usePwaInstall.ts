/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  MÓDULO PWA — BLINDADO                                  ║
 * ║                                                         ║
 * ║  Este arquivo é o ponto central de toda a lógica de     ║
 * ║  instalação PWA do sistema. NÃO deve ser alterado       ║
 * ║  sem revisão completa dos testes de estabilidade.       ║
 * ║                                                         ║
 * ║  Arquivos vinculados:                                   ║
 * ║  - src/hooks/usePwaInstall.ts (este arquivo)            ║
 * ║  - src/hooks/usePwaNotifications.ts                     ║
 * ║  - src/components/PwaInstallBanner.tsx                  ║
 * ║  - src/components/PwaFooterInstall.tsx                  ║
 * ║  - src/components/home/PwaInstallSection.tsx            ║
 * ║  - src/pages/AdminPwaPage.tsx                           ║
 * ║  - src/sw.ts                                            ║
 * ║  - src/test/stability-pwa.test.ts                       ║
 * ║                                                         ║
 * ║  Tabelas no banco:                                      ║
 * ║  - pwa_install_settings                                 ║
 * ║  - pwa_install_events                                   ║
 * ║  - push_subscriptions                                   ║
 * ║                                                         ║
 * ║  Secrets:                                               ║
 * ║  - VAPID_PUBLIC_KEY                                     ║
 * ║  - VAPID_PRIVATE_KEY                                    ║
 * ║                                                         ║
 * ║  REGRAS OBRIGATÓRIAS:                                   ║
 * ║  1. ZERO restrição por dispositivo (sem userAgent)      ║
 * ║  2. ZERO mensagem técnica restritiva                    ║
 * ║  3. Popup FECHA SEM travar interface (try/finally)      ║
 * ║  4. Botões SEMPRE visíveis (seção home + footer)        ║
 * ║  5. Popup automático + reabrível via CustomEvent        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Constants ───────────────────────────────────────────────
const DISMISS_KEY = 'pwa_install_dismissed_v2';
const VISIT_KEY = 'pwa_visit_count';
const IMPRESSION_KEY = 'pwa_impression_count';

/** Custom event name used to open the install modal from any CTA */
export const PWA_OPEN_INSTALL_MODAL_EVENT = 'pwa:open-install-modal';

// ─── Types ───────────────────────────────────────────────────
export interface PwaSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  cta_text: string;
  dismiss_text: string;
  ios_instruction: string;
  show_delay_seconds: number;
  min_visits: number;
  dismiss_cooldown_days: number;
  max_impressions: number;
  show_in_footer: boolean;
  show_homepage_section: boolean;
  show_floating_banner: boolean;
  show_for_logged_in: boolean;
  show_for_visitors: boolean;
  show_on_mobile: boolean;
  show_on_desktop: boolean;
  accent_color: string;
  animation_type: string;
  animation_duration: number;
  homepage_section_title: string;
  homepage_section_subtitle: string;
  homepage_section_cta: string;
  footer_cta_text: string;
}

// ─── Default Settings ────────────────────────────────────────
const defaultSettings: PwaSettings = {
  enabled: true,
  title: 'Instale o App',
  subtitle: 'Acesse mais rápido direto da tela inicial',
  cta_text: 'Instalar App',
  dismiss_text: 'Agora não',
  ios_instruction: '',
  show_delay_seconds: 5,
  min_visits: 1,
  dismiss_cooldown_days: 7,
  max_impressions: 0,
  show_in_footer: true,
  show_homepage_section: true,
  show_floating_banner: true,
  show_for_logged_in: true,
  show_for_visitors: true,
  show_on_mobile: true,
  show_on_desktop: true,
  accent_color: '#F97316',
  animation_type: 'slide-up',
  animation_duration: 300,
  homepage_section_title: 'Tenha o app na palma da mão',
  homepage_section_subtitle: 'Instale gratuitamente e acesse profissionais, serviços e vagas com um toque.',
  homepage_section_cta: 'Instalar Agora',
  footer_cta_text: 'Instalar App',
};

// ─── Hook: Settings from DB ─────────────────────────────────
export function usePwaSettings() {
  return useQuery({
    queryKey: ['pwa-install-settings'],
    initialData: defaultSettings,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pwa_install_settings' as any)
        .select('*')
        .limit(1)
        .single();

      if (error) return defaultSettings;
      return (data as unknown as PwaSettings) || defaultSettings;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Hook: Standalone detection ─────────────────────────────
export function useIsStandalone() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    setStandalone(mq.matches || (navigator as any).standalone === true);

    const handler = (e: MediaQueryListEvent) => setStandalone(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return standalone;
}

// ─── Analytics helper ────────────────────────────────────────
export function trackPwaEvent(eventType: string, source: string) {
  const deviceType = window.innerWidth < 768 ? 'mobile' : 'desktop';
  supabase
    .from('pwa_install_events' as any)
    .insert({ event_type: eventType, source, device_type: deviceType } as any)
    .then(() => {});
}

// ─── Main Hook: Install Prompt ──────────────────────────────
/**
 * Central PWA install hook.
 *
 * RULES (DO NOT VIOLATE):
 * - No device restrictions — works on ANY device with beforeinstallprompt
 * - No iOS-specific instructions — silent fallback only
 * - install() ALWAYS cleans up in finally block to prevent UI freeze
 * - canInstall becomes false after install() to avoid stale prompts
 */
export function usePwaInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const isStandalone = useIsStandalone();
  const promptRef = useRef<any>(null);

  useEffect(() => {
    if (isStandalone) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e;
      setCanInstall(true);
    };

    const onAppInstalled = () => {
      promptRef.current = null;
      setCanInstall(false);
      trackPwaEvent('installed', 'system');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [isStandalone]);

  const install = useCallback(async (source: string = 'banner') => {
    const prompt = promptRef.current;
    if (!prompt || isStandalone) return false;

    let accepted = false;

    try {
      trackPwaEvent('cta_click', source);
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      accepted = outcome === 'accepted';
      trackPwaEvent(accepted ? 'accepted' : 'dismissed', source);
    } catch {
      // Silent — by design
    } finally {
      // CRITICAL: Always clean up regardless of outcome
      // This prevents interface blocking / stale overlay
      promptRef.current = null;
      setCanInstall(false);
    }

    return accepted;
  }, [isStandalone]);

  const dismiss = useCallback((source: string = 'banner') => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    trackPwaEvent('dismissed', source);
  }, []);

  const isDismissed = useCallback((cooldownDays: number) => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    return Date.now() - Number(dismissed) < cooldownDays * 86400000;
  }, []);

  const getVisitCount = useCallback(() => {
    const visits = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    return visits;
  }, []);

  const getImpressionCount = useCallback(
    () => Number(localStorage.getItem(IMPRESSION_KEY) || '0'),
    [],
  );

  const incrementImpressions = useCallback(() => {
    const count = Number(localStorage.getItem(IMPRESSION_KEY) || '0') + 1;
    localStorage.setItem(IMPRESSION_KEY, String(count));
    return count;
  }, []);

  return {
    canInstall: canInstall && !isStandalone,
    isStandalone,
    install,
    dismiss,
    isDismissed,
    getVisitCount,
    getImpressionCount,
    incrementImpressions,
  };
}
