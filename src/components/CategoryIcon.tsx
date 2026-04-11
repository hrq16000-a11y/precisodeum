import { icons } from 'lucide-react';

interface CategoryIconProps {
  icon: string;
  size?: number;
  className?: string;
}

/** Render a Lucide icon by slug name, falling back to emoji/text if not found */
const CategoryIcon = ({ icon, size = 18, className = 'text-slate-600' }: CategoryIconProps) => {
  const LucideIcon = (icons as Record<string, any>)[icon];
  if (LucideIcon) {
    return <LucideIcon size={size} strokeWidth={1.75} className={className} />;
  }
  return <span className="text-lg leading-none">{icon}</span>;
};

export default CategoryIcon;
