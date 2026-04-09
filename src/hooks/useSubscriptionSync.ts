import { supabase } from '@/integrations/supabase/client';
import { logAuditAction } from '@/hooks/useAuditLog';

interface SyncParams {
  subscriptionId: string;
  providerId: string;
  newStatus: string;
  newAccountTypeId?: string | null;
  previousStatus?: string;
  previousAccountTypeId?: string | null;
}

/**
 * When an admin changes a subscription, automatically sync
 * the user's profile account_type_id and log the audit event.
 */
export const syncSubscriptionToProfile = async (params: SyncParams) => {
  const { subscriptionId, providerId, newStatus, newAccountTypeId, previousStatus, previousAccountTypeId } = params;

  // Find the user_id from the provider
  const { data: provider } = await supabase
    .from('providers')
    .select('user_id')
    .eq('id', providerId)
    .single();

  if (!provider?.user_id) return;

  const userId = provider.user_id;

  // Determine if this is an upgrade, downgrade, or cancellation
  const isCanceled = newStatus === 'canceled' || newStatus === 'expired';
  const isActive = newStatus === 'active';

  if (isCanceled) {
    // Find the "Trial" or lowest account_type to downgrade to
    const { data: trialType } = await supabase
      .from('account_types')
      .select('id')
      .or('name.ilike.%trial%,name.ilike.%gratuito%,name.ilike.%free%')
      .order('price', { ascending: true })
      .limit(1)
      .single();

    if (trialType) {
      await supabase
        .from('profiles')
        .update({ account_type_id: trialType.id, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    await logAuditAction({
      action: 'update',
      resource_type: 'subscription',
      resource_id: subscriptionId,
      details: {
        action_type: 'plan_downgraded',
        provider_id: providerId,
        user_id: userId,
        previous_status: previousStatus,
        new_status: newStatus,
        downgraded_to: trialType?.id || 'unknown',
      },
    });
  } else if (isActive && newAccountTypeId) {
    // Upgrade: set the new account_type on the profile
    await supabase
      .from('profiles')
      .update({ account_type_id: newAccountTypeId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    const isUpgrade = !previousAccountTypeId || previousAccountTypeId !== newAccountTypeId;

    await logAuditAction({
      action: 'update',
      resource_type: 'subscription',
      resource_id: subscriptionId,
      details: {
        action_type: isUpgrade ? 'plan_upgraded' : 'subscription_changed',
        provider_id: providerId,
        user_id: userId,
        previous_account_type: previousAccountTypeId,
        new_account_type: newAccountTypeId,
        new_status: newStatus,
      },
    });
  }
};
