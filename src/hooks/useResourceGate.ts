/**
 * DEPRECATED (Soft Deprecation): Platform is 100% free.
 * Always returns allowed: true for all resources.
 */

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

export const useResourceGate = () => {
  const check = (_resource: ResourceKey): GateResult => ({ allowed: true });

  return { check, loading: false, limits: null, permissions: null };
};
