import { useAccountLimits } from '@/hooks/useAccountLimits';
import { usePermissions } from '@/hooks/usePermissions';

type ResourceKey =
  | 'can_create_services'
  | 'can_receive_leads'
  | 'can_access_crm'
  | 'can_access_reports'
  | 'can_access_featured'
  | 'max_services'
  | 'max_leads'
  | 'max_ads'
  | 'max_slots';

interface GateResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralized resource gate engine.
 * Checks plan limits + permissions to determine if a user can perform an action.
 */
export const useResourceGate = () => {
  const { limits, loading: limitsLoading, canCreateService, canReceiveMoreLeads, remainingServices, remainingLeads } = useAccountLimits();
  const { permissions, loading: permLoading } = usePermissions();

  const loading = limitsLoading || permLoading;

  const check = (resource: ResourceKey): GateResult => {
    if (loading) return { allowed: false, reason: 'Carregando permissões...' };
    if (!limits) return { allowed: false, reason: 'Sem plano ativo' };

    switch (resource) {
      case 'can_create_services':
        return canCreateService
          ? { allowed: true }
          : { allowed: false, reason: remainingServices === 0 ? 'Limite de serviços atingido' : 'Seu plano não permite criar serviços' };

      case 'can_receive_leads':
        return canReceiveMoreLeads
          ? { allowed: true }
          : { allowed: false, reason: 'Limite de leads atingido para seu plano' };

      case 'can_access_crm':
        return (limits as any).can_access_crm
          ? { allowed: true }
          : { allowed: false, reason: 'CRM não disponível no seu plano' };

      case 'can_access_reports':
        return (limits as any).can_access_reports
          ? { allowed: true }
          : { allowed: false, reason: 'Relatórios não disponíveis no seu plano' };

      case 'can_access_featured':
        return (limits as any).can_access_featured
          ? { allowed: true }
          : { allowed: false, reason: 'Destaque não disponível no seu plano' };

      case 'max_services':
        return { allowed: remainingServices === null || (remainingServices ?? 0) > 0, reason: remainingServices === 0 ? 'Limite de serviços atingido' : undefined };

      case 'max_leads':
        return { allowed: remainingLeads === null || (remainingLeads ?? 0) > 0, reason: remainingLeads === 0 ? 'Limite de leads atingido' : undefined };

      case 'max_ads':
        return (limits as any).max_ads === -1 || (limits as any).max_ads > 0
          ? { allowed: true }
          : { allowed: false, reason: 'Anúncios não disponíveis no seu plano' };

      case 'max_slots':
        return (limits as any).max_slots === -1 || (limits as any).max_slots > 0
          ? { allowed: true }
          : { allowed: false, reason: 'Slots não disponíveis no seu plano' };

      default:
        return { allowed: false, reason: 'Recurso desconhecido' };
    }
  };

  return { check, loading, limits, permissions };
};
