import { UserRound } from 'lucide-react';
import { AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface AvatarFallbackIconProps {
  className?: string;
  iconClassName?: string;
  rounded?: 'full' | 'xl' | '2xl';
  /** Override icon (defaults to UserRound). */
  Icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Premium fallback for Avatar when no image is available.
 *
 * Replaces the previous "single initial" pattern with an elegant,
 * authority-feeling badge: dark gradient + light icon + subtle inner border.
 * Use inside <Avatar> instead of <AvatarFallback>{initials}</AvatarFallback>.
 */
export function AvatarFallbackIcon({
  className,
  iconClassName,
  rounded = 'full',
  Icon = UserRound,
}: AvatarFallbackIconProps) {
  const radius =
    rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-2xl';
  return (
    <AvatarFallback
      className={cn(
        'bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 shadow-inner',
        radius,
        className,
      )}
    >
      <Icon className={cn('w-1/2 h-1/2 text-slate-300', iconClassName)} />
    </AvatarFallback>
  );
}

export default AvatarFallbackIcon;
