import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useProviderPresence,
  useProviderLastSeen,
  useLastPresenceSync,
  useRealtimeHealth,
  RECENTLY_OFFLINE_WINDOW_MS,
} from '@/hooks/useOnlinePresence';
import { cn } from '@/lib/utils';

interface OnlineBadgeProps {
  userId: string | undefined;
  /** Visual size variant */
  size?: 'sm' | 'md';
  /** When true and the user is offline, render a muted "Offline" badge with lastSeen tooltip. */
  showOffline?: boolean;
  /** Show small "atualizado há Xs" freshness label next to the badge. */
  showFreshness?: boolean;
  /**
   * Time window (ms) within which an offline user still shows the "Offline" badge.
   * After this, the badge disappears so the card falls back to neutral state.
   * Defaults to RECENTLY_OFFLINE_WINDOW_MS (10 min).
   */
  offlineVisibleWindowMs?: number;
  className?: string;
}

function formatFullRelative(ms: number): string {
  const seconds = Math.max(1, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
}

function formatRelative(ms: number): string {
  const seconds = Math.max(1, Math.floor(ms / 1000));
  if (seconds < 60) return 'há poucos segundos';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function formatShortRelative(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/**
 * Reusable Online badge with a smooth, consistent pulse animation
 * (no harsh ping flashes) and a tooltip showing when the provider
 * came online. Powered by Supabase Realtime presence — updates live
 * without page reloads.
 */
export function OnlineBadge({
  userId,
  size = 'sm',
  showOffline = false,
  showFreshness = false,
  offlineVisibleWindowMs = RECENTLY_OFFLINE_WINDOW_MS,
  className,
}: OnlineBadgeProps) {
  const presence = useProviderPresence(userId);
  const lastSeen = useProviderLastSeen(userId);
  const lastSync = useLastPresenceSync();
  const health = useRealtimeHealth();
  const [, setTick] = useState(0);

  // Re-render every 15s so relative/freshness labels stay fresh.
  useEffect(() => {
    if (!presence && !lastSeen) return;
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [presence, lastSeen]);

  // Realtime fallback: when Supabase Realtime is degraded, hide Online/Offline
  // badges entirely so the card falls back gracefully to rating / "Disponível hoje".
  if (health === 'degraded') return null;

  // Discrete skeleton during the initial Realtime handshake — avoids
  // a jarring "Online" appearing 1–2s after card mount.
  if (health === 'connecting' && !presence && !lastSeen) {
    const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-muted/30 ring-1 ring-border/50 animate-pulse',
          padding,
          className,
        )}
        aria-hidden="true"
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-10 rounded-full bg-muted-foreground/20" />
      </span>
    );
  }

  // Offline state with optional lastSeen tooltip
  if (!presence) {
    if (!showOffline || !lastSeen) return null;
    const elapsed = Date.now() - lastSeen;
    // Hide offline badge once we're past the configured window
    if (elapsed > offlineVisibleWindowMs) return null;
    const offlineRelative = formatFullRelative(elapsed);
    const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-muted/40 font-medium text-muted-foreground ring-1 ring-border cursor-default',
                padding,
                className,
              )}
              aria-label={`Visto pela última vez há ${offlineRelative}`}
              role="status"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/50" />
              Offline
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="text-xs">
            <div className="font-medium">Offline no momento</div>
            <div className="text-muted-foreground">Visto pela última vez há {offlineRelative}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const since = presence.onlineSince ?? Date.now();
  const relative = formatRelative(Date.now() - since);
  const freshnessMs = lastSync ? Date.now() - lastSync : 0;
  const freshness = formatShortRelative(freshnessMs);

  const dotSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2';
  const ringSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 font-semibold text-emerald-600 ring-1 ring-emerald-500/30 cursor-default',
                padding,
              )}
              aria-label={`Profissional online ${relative}`}
              role="status"
            >
              <span className={cn('relative inline-flex items-center justify-center', ringSize)}>
                <span
                  className={cn(
                    'absolute inline-flex rounded-full bg-emerald-500/40',
                    ringSize,
                    'animate-online-pulse',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex rounded-full bg-emerald-500 shadow-[0_0_6px_hsl(var(--primary)/0)]',
                    dotSize,
                    'animate-online-breath',
                  )}
                />
              </span>
              Online
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="text-xs">
            <div className="font-medium">Online agora</div>
            <div className="text-muted-foreground">Conectado {relative}</div>
            {lastSync > 0 && (
              <div className="text-muted-foreground">Atualizado há {freshness}</div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {showFreshness && lastSync > 0 && (
        <span
          className="text-[10px] text-muted-foreground tabular-nums"
          aria-label={`Atualizado há ${freshness}`}
        >
          atualizado há {freshness}
        </span>
      )}
    </span>
  );
}

export default OnlineBadge;
