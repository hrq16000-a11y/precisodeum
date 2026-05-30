import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useEngagementLevel } from '@/hooks/useEngagementLevel';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { resolveEffectiveProfileType } from '@/lib/onboardingAccess';

/**
 * useDashboardPermissions
 * -----------------------
 * Consolida `useAuth + usePermissions + useEngagementLevel + useSettingValue`
 * e a derivação de `profile_type` em um único hook.
 *
 * Não muda nenhuma lógica — apenas centraliza para o `DashboardPage` ficar enxuto.
 */
export function useDashboardPermissions() {
  const { user, profile, provider, loading, refetchProfile } = useAuth();
  const { levelName: legacyLevelName, levelColor: legacyLevelColor } = usePermissions();
  const { currentLevel } = useEngagementLevel();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');

  const profileType = resolveEffectiveProfileType(profile, provider);
  const isClient = profileType === 'client';
  const isRH = profileType === 'rh';
  const isProvider = profileType === 'provider';
  const isAdmin = profile?.profile_type === 'admin';
  const canAccess = !!user && !!profileType;

  // FONTE DA VERDADE para o nível do prestador: gamification_levels via engagement_points.
  const levelName = currentLevel?.name || legacyLevelName;
  const levelColor = currentLevel?.color || legacyLevelColor;

  return {
    user,
    profile,
    provider,
    loading,
    refetchProfile,
    profileType,
    isClient,
    isRH,
    isProvider,
    isAdmin,
    canAccess,
    levelName,
    levelColor,
    whatsappGroupUrl,
  };
}
