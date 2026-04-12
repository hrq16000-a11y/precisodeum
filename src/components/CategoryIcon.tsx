import { icons, CircleDot } from 'lucide-react';

interface CategoryIconProps {
  icon: string;
  size?: number;
  className?: string;
}

/** Build a case-insensitive lookup map once */
const iconMap: Record<string, React.ComponentType<any>> = {};
for (const [key, component] of Object.entries(icons)) {
  iconMap[key.toLowerCase()] = component as React.ComponentType<any>;
}

/** Render a Lucide icon by slug name, falling back to a generic icon if not found */
const CategoryIcon = ({ icon, size = 18, className = 'text-slate-600' }: CategoryIconProps) => {
  if (!icon) return <CircleDot size={size} strokeWidth={1.75} className={className} />;

  // Try exact match first, then case-insensitive
  const LucideIcon =
    (icons as Record<string, any>)[icon] ||
    iconMap[icon.toLowerCase()];

  if (LucideIcon) {
    return <LucideIcon size={size} strokeWidth={1.75} className={className} />;
  }

  // Fallback: generic icon instead of rendering text
  return <CircleDot size={size} strokeWidth={1.75} className={className} />;
};

export default CategoryIcon;
