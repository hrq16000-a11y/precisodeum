import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProviderPresence } from '@/hooks/useOnlinePresence';
import { cn } from '@/lib/utils';

interface OnlineBadgeProps {
  userId: string | undefined;
  /** Visual size variant */
  size?: 'sm' | 'md';
  className?: string;
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

/**
 * Reusable Online badge with a smooth, consistent pulse animation
 * (no harsh ping flashes) and a tooltip showing when the provider
 * came online. Powered by Supabase Realtime presence — updates live
 * without page reloads.
 */
export function OnlineBadge({ userId, size = 'sm', className }: OnlineBadgeProps) {
  const presence = useProviderPresence(userId);
  const [, setTick] = useState(0);

  // Re-render once a minute so the relative time stays fresh.
  useEffect(() => {
    if (!presence) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [presence]);

  if (!presence) return null;

  const since = presence.onlineSince ?? Date.now();
  const relative = formatRelative(Date.now() - since);

  const dotSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2';
  const ringSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  const padding = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 font-semibold text-emerald-600 ring-1 ring-emerald-500/30 cursor-default',
              padding,
              className,
            )}
            aria-label={`Profissional online ${relative}`}
            role="status"
          >
            <span className={cn('relative inline-flex items-center justify-center', ringSize)}>
              {/* Smooth, low-opacity ring (slower than animate-ping for a softer effect) */}
              <span
                className={cn(
                  'absolute inline-flex rounded-full bg-emerald-500/40',
                  ringSize,
                  'animate-online-pulse',
                )}
              />
              {/* Solid core dot with gentle breathing */}
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
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default OnlineBadge;
