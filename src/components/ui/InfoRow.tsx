import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoRowProps {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

/**
 * Standardized icon + text row for attribute display.
 * Supports automatic line wrapping and never truncates content.
 */
const InfoRow = ({ icon: Icon, children, className }: InfoRowProps) => {
  if (!children) return null;
  return (
    <div
      className={cn(
        'flex items-start gap-[0.5rem] text-sm text-muted-foreground',
        className
      )}
      style={{ whiteSpace: 'normal' }}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  );
};

export default InfoRow;
