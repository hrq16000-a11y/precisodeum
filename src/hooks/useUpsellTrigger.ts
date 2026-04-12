import { useMemo } from 'react';
import { useAccountLimits } from '@/hooks/useAccountLimits';

export type UpsellLevel = 'none' | 'warning' | 'critical';

export interface UpsellState {
  level: UpsellLevel;
  /** Percentage of limit used (0-100+) */
  servicesPct: number | null;
  leadsPct: number | null;
  /** Which resource hit the threshold first */
  trigger: 'services' | 'leads' | null;
  /** Human message */
  message: string | null;
  /** Is premium/unlimited */
  isPremium: boolean;
  loading: boolean;
}

export const useUpsellTrigger = (): UpsellState => {
  const {
    limits, model, loading,
    currentServices, currentLeads,
    remainingServices, remainingLeads,
  } = useAccountLimits();

  return useMemo(() => {
    if (loading || !limits) {
      return { level: 'none', servicesPct: null, leadsPct: null, trigger: null, message: null, isPremium: false, loading };
    }

    const isPremium = model?.is_premium ?? false;
    if (isPremium) {
      return { level: 'none', servicesPct: null, leadsPct: null, trigger: null, message: null, isPremium: true, loading: false };
    }

    const maxS = limits.max_services;
    const maxL = limits.max_leads;

    const sPct = maxS && maxS > 0 ? Math.round((currentServices / maxS) * 100) : null;
    const lPct = maxL && maxL > 0 ? Math.round((currentLeads / maxL) * 100) : null;

    let level: UpsellLevel = 'none';
    let trigger: 'services' | 'leads' | null = null;
    let message: string | null = null;

    // Check services
    if (sPct !== null && sPct >= 100) {
      level = 'critical';
      trigger = 'services';
      message = `Você atingiu o limite de ${maxS} serviços do seu plano. Faça upgrade para cadastrar mais.`;
    } else if (sPct !== null && sPct >= 80) {
      level = 'warning';
      trigger = 'services';
      message = `Você está usando ${currentServices} de ${maxS} serviços. Considere o upgrade.`;
    }

    // Check leads (override if more critical)
    if (lPct !== null && lPct >= 100 && (level !== 'critical' || trigger !== 'services')) {
      level = 'critical';
      trigger = 'leads';
      message = `Você atingiu o limite de ${maxL} leads do seu plano. Faça upgrade para receber mais.`;
    } else if (lPct !== null && lPct >= 80 && level === 'none') {
      level = 'warning';
      trigger = 'leads';
      message = `Você tem ${currentLeads} de ${maxL} leads. Considere o upgrade.`;
    }

    return { level, servicesPct: sPct, leadsPct: lPct, trigger, message, isPremium: false, loading: false };
  }, [limits, model, loading, currentServices, currentLeads, remainingServices, remainingLeads]);
};
