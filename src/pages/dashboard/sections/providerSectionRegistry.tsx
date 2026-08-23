import type { JSX } from "react";
import { lazy, Suspense } from 'react';
import WelcomeHero from '@/components/dashboard/WelcomeHero';
import QuickStatsBar from '@/components/dashboard/QuickStatsBar';
import DashboardTipOfDay from '@/components/dashboard/DashboardTipOfDay';
import LevelBenefits from '@/components/dashboard/LevelBenefits';
import ShareProfileCard from '@/components/dashboard/ShareProfileCard';
import QrCodeCard from '@/components/dashboard/QrCodeCard';
import ActionQueue from '@/components/dashboard/ActionQueue';
import CoursesBanner from '@/components/dashboard/CoursesBanner';
import OurStoryBanner from '@/components/OurStoryBanner';
import StorageQuotaWidget from '@/components/dashboard/StorageQuotaWidget';
import FirstLeadChecklist from '@/components/dashboard/FirstLeadChecklist';
import ProfileLocationChecklist from '@/components/dashboard/ProfileLocationChecklist';
import IncompleteLocationAlert from '@/components/dashboard/IncompleteLocationAlert';
import SmartNextStepCTA from '@/components/dashboard/SmartNextStepCTA';
import OnboardingCompletionTracker from '@/components/dashboard/OnboardingCompletionTracker';
import LeadFollowupWidget from '@/components/dashboard/LeadFollowupWidget';
import EmptyStateBanner from '@/components/dashboard/EmptyStateBanner';
import CommunityVerifiedStatus from '@/components/dashboard/CommunityVerifiedStatus';
import ServiceCompletionCard from '@/components/dashboard/ServiceCompletionCard';
import DailyPostCard from '@/components/dashboard/DailyPostCard';
import MissedOpportunitiesWidget from '@/components/dashboard/MissedOpportunitiesWidget';
import ReferralInviteCard from '@/components/dashboard/ReferralInviteCard';
import EngagementLoop from '@/components/dashboard/EngagementLoop';
import ExpertTipsWidget from '@/components/dashboard/ExpertTipsWidget';
import DismissibleWidget from '@/components/dashboard/DismissibleWidget';
import MissionCard from '@/components/dashboard/MissionCard';
import MetricsPreviewCard from '@/components/dashboard/MetricsPreviewCard';
import OnlineStatusFeedback from '@/components/dashboard/OnlineStatusFeedback';
import OnlineStatusToggle from '@/components/dashboard/OnlineStatusToggle';
import DashboardPwaInstallNudge from '@/components/dashboard/DashboardPwaInstallNudge';
import IdentitySuggestionsWidget from '@/components/dashboard/IdentitySuggestionsWidget';
import UnifiedHealthScore from '@/components/dashboard/UnifiedHealthScore';
import QuickActionsHero from '@/components/dashboard/QuickActionsHero';
import SectionSkeleton from '@/pages/dashboard/sections/_skeleton';

const ProviderInsightsCollapsible = lazy(
  () => import('@/pages/dashboard/sections/ProviderInsightsCollapsible'),
);
const ProviderQuickAccess = lazy(
  () => import('@/pages/dashboard/sections/ProviderQuickAccess'),
);
const ProviderOnboardingStepper = lazy(
  () => import('@/pages/dashboard/sections/ProviderOnboardingStepper'),
);

export interface ProviderRegistryArgs {
  profile: any;
  provider: any;
  greeting: string;
  pendingLeads: number;
  levelName: string | undefined;
  levelColor: string | undefined;
  servicesCount: number | null;
  portfolioCount: number;
  portfolioAlbumCount: number;
  leadsCount: number;
  viewsTotal: number;
  reviewCount: number;
  completenessPercent: number;
  remainingItems: number;
  allChecklistDone: boolean;
  anyEmptyBannerVisible: boolean;
  showServiceEmptyBanner: boolean;
  showPortfolioEmptyBanner: boolean;
  isCompanyProvider: boolean;
  showFullAddress: boolean;
  providerSteps: any[];
  allStepsDone: boolean;
  guideOpen: boolean;
  onToggleGuide: () => void;
}

/**
 * Builder do registro de seções configuráveis do dashboard provider.
 * Mapeia chaves estáveis → render functions. Mantém EXATAMENTE o JSX
 * original do DashboardPage.tsx (zero mudanças visuais/funcionais).
 *
 * Ordem/visibilidade é controlada pelo admin via /admin/dashboard-layout
 * (chave `dashboard_layout_provider` em site_settings).
 */
export function buildProviderSectionRegistry(
  args: ProviderRegistryArgs,
): Record<string, () => JSX.Element | null> {
  const {
    profile,
    provider,
    greeting,
    pendingLeads,
    levelName,
    levelColor,
    servicesCount,
    portfolioCount,
    portfolioAlbumCount,
    leadsCount,
    viewsTotal,
    reviewCount,
    completenessPercent,
    remainingItems,
    allChecklistDone,
    anyEmptyBannerVisible,
    showServiceEmptyBanner,
    showPortfolioEmptyBanner,
    isCompanyProvider,
    showFullAddress,
    providerSteps,
    allStepsDone,
    guideOpen,
    onToggleGuide,
  } = args;

  return {
    welcome_hero: () => (
      <WelcomeHero
        greeting={greeting}
        name={profile?.full_name?.split(' ')[0] || 'Profissional'}
        pendingLeads={pendingLeads}
        levelName={levelName}
        levelColor={levelColor}
        memberSince={profile?.created_at}
        avatarUrl={profile?.avatar_url || undefined}
      />
    ),
    quick_actions_hero: () => (
      <div className="mt-6"><QuickActionsHero /></div>
    ),
    onboarding_completion_tracker: () => (
      <div className="mt-4">
        <OnboardingCompletionTracker
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
        />
      </div>
    ),
    unified_health_score: () => (
      <div className="mt-4">
        <UnifiedHealthScore score={completenessPercent} remaining={remainingItems} />
      </div>
    ),
    daily_post_card: () =>
      provider?.id ? <div className="mt-4"><DailyPostCard /></div> : null,
    metrics_preview: () =>
      provider?.id ? (
        <div className="mt-6">
          <MetricsPreviewCard
            viewsTotal={viewsTotal}
            leadsCount={leadsCount}
            contactClicks={(provider as any)?.contact_clicks_count ?? 0}
          />
        </div>
      ) : null,
    online_status_feedback: () => (
      <div className="mt-3 flex justify-end" data-tour="online-status">
        <OnlineStatusFeedback />
      </div>
    ),
    online_status_toggle: () =>
      provider?.id ? (
        <div className="mt-3" data-tour="online-toggle"><OnlineStatusToggle /></div>
      ) : null,
    pwa_install_nudge: () =>
      provider?.id ? <div className="mt-3"><DashboardPwaInstallNudge /></div> : null,
    mission_card: () => (
      <div className="mt-4" data-tour="missions"><MissionCard /></div>
    ),
    identity_suggestions: () => (
      <div className="mt-4"><IdentitySuggestionsWidget limit={2} /></div>
    ),
    service_completion_card: () => (
      <div className="mt-4"><ServiceCompletionCard /></div>
    ),
    engagement_loop: () => (
      <div className="mt-4">
        <EngagementLoop
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
          unifiedPct={completenessPercent}
        />
      </div>
    ),
    empty_banners: () => (
      <>
        {showServiceEmptyBanner && (
          <div className="mt-4"><EmptyStateBanner variant="service" /></div>
        )}
        {showPortfolioEmptyBanner && (
          <div className="mt-4"><EmptyStateBanner variant="portfolio" /></div>
        )}
      </>
    ),
    smart_cta_or_checklist: () => {
      if (allChecklistDone) return null;
      if (anyEmptyBannerVisible && remainingItems <= 1) return null;
      if (remainingItems <= 1) {
        return (
          <div className="mt-4">
            <SmartNextStepCTA
              servicesCount={servicesCount ?? 0}
              portfolioAlbumsCount={portfolioAlbumCount}
            />
          </div>
        );
      }
      return (
        <>
          <IncompleteLocationAlert provider={provider as any} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DismissibleWidget widgetKey="first_lead_checklist">
              <FirstLeadChecklist
                servicesCount={servicesCount ?? 0}
                portfolioAlbumsCount={portfolioAlbumCount}
              />
            </DismissibleWidget>
            <DismissibleWidget widgetKey="profile_location_checklist">
              <ProfileLocationChecklist provider={provider as any} />
            </DismissibleWidget>
            <CommunityVerifiedStatus />
          </div>
        </>
      );
    },
    expert_tips: () =>
      provider ? (
        <div className="mt-4">
          <DismissibleWidget widgetKey="expert_tips">
            <ExpertTipsWidget />
          </DismissibleWidget>
        </div>
      ) : null,
    lead_followup: () => (
      <div className="mt-4"><LeadFollowupWidget /></div>
    ),
    insights_collapsible: () => (
      <Suspense fallback={<SectionSkeleton minH="min-h-16" />}>
        <ProviderInsightsCollapsible avatarUrl={profile?.avatar_url} />
      </Suspense>
    ),
    share_profile_card: () =>
      provider?.slug ? (
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2" data-tour="share">
          <ShareProfileCard />
          <QrCodeCard />
          <StorageQuotaWidget />
        </div>
      ) : null,
    courses_banner: () => (
      <div className="mt-4"><CoursesBanner /></div>
    ),
    quick_stats_bar: () => (
      <QuickStatsBar pendingLeads={pendingLeads} providerSlug={provider?.slug} />
    ),
    action_queue: () => (
      <div className="mt-4">
        <ActionQueue
          servicesCount={servicesCount ?? 0}
          portfolioAlbumsCount={portfolioAlbumCount}
        />
      </div>
    ),
    tip_and_benefits: () =>
      provider ? (
        <div className="mt-6 grid gap-4 grid-cols-1 lg:grid-cols-2">
          <DashboardTipOfDay
            servicesCount={servicesCount ?? 0}
            portfolioCount={portfolioCount}
            leadsCount={leadsCount}
            reviewCount={reviewCount}
          />
          <LevelBenefits />
        </div>
      ) : null,
    quick_access: () => (
      <Suspense fallback={<SectionSkeleton minH="min-h-[280px]" />}>
        <ProviderQuickAccess
          servicesCount={servicesCount}
          providerSlug={provider?.slug ?? null}
          providerId={provider?.id ?? null}
          isCompanyProvider={isCompanyProvider}
          showFullAddress={showFullAddress}
          levelName={(profile as any)?.levelInfo?.name ?? null}
        />
      </Suspense>
    ),
    onboarding_stepper: () => (
      <Suspense fallback={<SectionSkeleton minH="min-h-[180px]" />}>
        <ProviderOnboardingStepper
          steps={providerSteps}
          allStepsDone={allStepsDone}
          open={guideOpen}
          onToggle={onToggleGuide}
        />
      </Suspense>
    ),
    missed_opportunities: () =>
      provider?.id ? <div className="mt-6"><MissedOpportunitiesWidget /></div> : null,
    referral_invite: () =>
      provider?.id ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ReferralInviteCard />
        </div>
      ) : null,
    our_story_banner: () => <OurStoryBanner variant="compact" />,
  };
}
