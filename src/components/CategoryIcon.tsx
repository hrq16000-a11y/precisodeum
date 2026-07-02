/**
 * Legacy alias kept for backwards compatibility.
 * Forwards to the unified IconRenderer (single source of truth).
 */
import { IconRenderer } from '@/components/ui/IconRenderer';

interface CategoryIconProps {
  icon: string;
  size?: number;
  className?: string;
  color?: string;
  glow?: boolean;
}

const CategoryIcon = ({ icon, size = 18, className = 'text-slate-600', color, glow }: CategoryIconProps) => (
  <IconRenderer name={icon} size={size} className={className} color={color} glow={glow} />
);

export default CategoryIcon;
