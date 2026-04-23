import type { SponsorPermissionKey, SponsorPermissions } from '@/hooks/useSponsorAuth';

export interface SponsorSubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  features?: unknown;
}

export interface SponsorSubscription {
  id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  amount_paid: number | null;
  sponsor_plans?: SponsorSubscriptionPlan | null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export const isSponsorSubscriptionActive = (subscription: SponsorSubscription | null | undefined) => {
  if (!subscription || !ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() >= Date.now();
};

export const hasSponsorFeatureAccess = ({
  isAdmin,
  hasActivePlan,
  permissions,
  key,
}: {
  isAdmin: boolean;
  hasActivePlan: boolean;
  permissions: SponsorPermissions;
  key?: SponsorPermissionKey;
}) => {
  if (isAdmin) return true;
  if (!hasActivePlan) return false;
  if (!key) return true;
  return permissions[key] === true;
};