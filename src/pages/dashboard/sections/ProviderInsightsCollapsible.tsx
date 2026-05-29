import { ChevronDown, TrendingUp } from 'lucide-react';
import DemandSignalAlert from '@/components/dashboard/DemandSignalAlert';
import WeeklySummary from '@/components/dashboard/WeeklySummary';
import ProfileStrength from '@/components/dashboard/ProfileStrength';
import CategoryBenchmarkWidget from '@/components/dashboard/CategoryBenchmarkWidget';
import RegionalDemandWidget from '@/components/dashboard/RegionalDemandWidget';
import RankingStatus from '@/components/dashboard/RankingStatus';
import RankingAlertWidget from '@/components/dashboard/RankingAlertWidget';
import AvatarReminder from '@/components/dashboard/AvatarReminder';

interface ProviderInsightsCollapsibleProps {
  avatarUrl?: string | null;
}

/**
 * "Mais insights" — bloco colapsável com widgets secundários.
 * Lazy: o usuário só vê após rolar; estado de aberto/fechado vem do localStorage.
 */
const ProviderInsightsCollapsible = ({ avatarUrl }: ProviderInsightsCollapsibleProps) => {
  const initiallyOpen = typeof window !== 'undefined' && localStorage.getItem('dash_more_insights_open') === '1';

  return (
    <details
      className="group mt-4 rounded-2xl border border-border bg-card/60 [&_summary::-webkit-details-marker]:hidden"
      open={initiallyOpen}
      onToggle={(e) => {
        try {
          localStorage.setItem(
            'dash_more_insights_open',
            (e.currentTarget as HTMLDetailsElement).open ? '1' : '0',
          );
        } catch { /* ignore quota errors */ }
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-foreground">Mais insights</h3>
            <p className="text-[11px] text-muted-foreground truncate">
              Demanda, ranking, benchmark e força do perfil
            </p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1">
        <DemandSignalAlert />
        <WeeklySummary />
        <div data-tour="profile-strength">
          <ProfileStrength />
        </div>
        <CategoryBenchmarkWidget />
        <RegionalDemandWidget />
        <RankingStatus />
        <RankingAlertWidget />
        <AvatarReminder avatarUrl={avatarUrl ?? undefined} />
      </div>
    </details>
  );
};

export default ProviderInsightsCollapsible;
