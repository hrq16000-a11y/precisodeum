import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * DEPRECATED (Soft Deprecation): Platform is 100% free for professionals.
 * This hook now returns "unlimited/allowed" for everything.
 * Kept for backward compatibility with dashboard pages.
 */

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
  currentServices: number;
  currentLeads: number;
  canCreateService: boolean;
  canReceiveMoreLeads: boolean;
  remainingServices: number | null;
  remainingLeads: number | null;
  refetch: () => Promise<void>;
}

export const useAccountLimits = (): UseAccountLimitsReturn => {
  const { profile } = useAuth();

  const model: AccountModel = {
    account_tier: 'free',
    is_premium: true, // Everyone is "premium" in the free model
    is_provider: profile?.profile_type === 'provider',
    is_rh: profile?.profile_type === 'rh',
    profile_type: profile?.profile_type ?? 'client',
    plan: 'community',
  };

  const limits: AccountLimits = {
    max_services: null, // null = unlimited
    max_leads: null,
    can_create_services: true,
    can_receive_leads: true,
    account_tier: 'community',
  };

  const refetch = useCallback(async () => {}, []);

  return {
    model,
    limits,
    loading: false,
    currentServices: 0,
    currentLeads: 0,
    canCreateService: true,
    canReceiveMoreLeads: true,
    remainingServices: null, // null = unlimited
    remainingLeads: null,
    refetch,
  };
};
