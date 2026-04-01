import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AccountModel {
  account_tier: string | null;
  is_premium: boolean;
  is_provider: boolean;
  is_rh: boolean;
  profile_type: string | null;
  plan: string | null;
}

interface AccountLimits {
  max_services: number | null;
  max_leads: number | null;
  can_create_services: boolean;
  can_receive_leads: boolean;
  account_tier: string | null;
}

interface UseAccountLimitsReturn {
  model: AccountModel | null;
  limits: AccountLimits | null;
  loading: boolean;
  /** Current number of services the user has */
  currentServices: number;
  /** Current number of leads the user has */
  currentLeads: number;
  /** Whether the user can create a new service right now */
  canCreateService: boolean;
  /** Whether the user can receive more leads */
  canReceiveMoreLeads: boolean;
  /** Remaining service slots (null = unlimited) */
  remainingServices: number | null;
  /** Remaining lead slots (null = unlimited) */
  remainingLeads: number | null;
  refetch: () => Promise<void>;
}

export const useAccountLimits = (): UseAccountLimitsReturn => {
  const { profile } = useAuth();
  const userRef = profile?.user_ref;

  const [model, setModel] = useState<AccountModel | null>(null);
  const [limits, setLimits] = useState<AccountLimits | null>(null);
  const [currentServices, setCurrentServices] = useState(0);
  const [currentLeads, setCurrentLeads] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userRef) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [modelRes, limitsRes] = await Promise.all([
      supabase
        .from('account_model_view')
        .select('*')
        .eq('user_ref', userRef)
        .maybeSingle(),
      supabase
        .from('account_limits_view')
        .select('*')
        .eq('user_ref', userRef)
        .maybeSingle(),
    ]);

    if (modelRes.data) {
      setModel({
        account_tier: modelRes.data.account_tier,
        is_premium: modelRes.data.is_premium ?? false,
        is_provider: modelRes.data.is_provider ?? false,
        is_rh: modelRes.data.is_rh ?? false,
        profile_type: modelRes.data.profile_type,
        plan: modelRes.data.plan,
      });
    }

    if (limitsRes.data) {
      setLimits({
        max_services: limitsRes.data.max_services,
        max_leads: limitsRes.data.max_leads,
        can_create_services: limitsRes.data.can_create_services ?? false,
        can_receive_leads: limitsRes.data.can_receive_leads ?? false,
        account_tier: limitsRes.data.account_tier,
      });

      // Fetch current counts
      setCurrentServices(limitsRes.data.total_services ?? 0);
      setCurrentLeads(limitsRes.data.total_leads ?? 0);
    }

    // If the view doesn't have counts, fetch them separately
    if (limitsRes.data && (limitsRes.data as any).total_services === undefined) {
      // We need to count from the actual tables
      // Services count via user_ref on services table
      const { count: svcCount } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('user_ref', userRef)
        .is('deleted_at', null);
      setCurrentServices(svcCount ?? 0);

      const { count: leadCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_ref', userRef);
      setCurrentLeads(leadCount ?? 0);
    }

    setLoading(false);
  }, [userRef]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived values
  const canCreateService = !!limits?.can_create_services && (
    limits.max_services === null || limits.max_services === 0
      ? true // 0 or null = unlimited in the view
      : currentServices < limits.max_services
  );

  const canReceiveMoreLeads = !!limits?.can_receive_leads && (
    limits.max_leads === null || limits.max_leads === 0
      ? true
      : currentLeads < limits.max_leads
  );

  const remainingServices = limits?.max_services && limits.max_services > 0
    ? Math.max(0, limits.max_services - currentServices)
    : null;

  const remainingLeads = limits?.max_leads && limits.max_leads > 0
    ? Math.max(0, limits.max_leads - currentLeads)
    : null;

  return {
    model,
    limits,
    loading,
    currentServices,
    currentLeads,
    canCreateService,
    canReceiveMoreLeads,
    remainingServices,
    remainingLeads,
    refetch: fetchData,
  };
};
