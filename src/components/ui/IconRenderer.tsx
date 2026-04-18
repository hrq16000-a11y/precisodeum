import { icons, CircleDot, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * IconRenderer — universal Lucide icon renderer driven by a string from the database.
 *
 * Single source of truth for "icon-as-string" patterns (gamification levels,
 * categories, plan resources, menu items, etc.). Whatever the admin types in
 * /admin/gamificacao or /admin/categorias is rendered here as a real Lucide SVG,
 * everywhere on the platform — instantly, no extra mapping table needed.
 *
 * Resolution order:
 *   1. Exact PascalCase match (e.g. "Sparkles")
 *   2. Case-insensitive match (e.g. "sparkles", "SPARKLES")
 *   3. kebab-case → PascalCase ("circle-dot" → "CircleDot")
 *   4. Fallback: CircleDot (never renders raw text)
 *
 * Legacy emoji strings (e.g. "⭐") and unknown values gracefully degrade to the
 * fallback icon instead of leaking the raw string into the UI.
 */

// Build case-insensitive + kebab lookup once
const iconMap: Record<string, React.ComponentType<LucideProps>> = {};
for (const [key, component] of Object.entries(icons)) {
  iconMap[key.toLowerCase()] = component as React.ComponentType<LucideProps>;
}

const kebabToPascal = (s: string) =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');

const isLikelyEmoji = (s: string) => /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(s);

export interface IconRendererProps extends Omit<LucideProps, 'ref' | 'color'> {
  /** Icon name string from the database (e.g. "Sparkles", "leaf", "circle-dot") */
  name?: string | null;
  /** Pixel size. Defaults to 18. */
  size?: number;
  /** Optional Tailwind classes (color, stroke, etc.) */
  className?: string;
  /** Direct color (hex, hsl, css var) — overrides Tailwind text color when set. */
  color?: string;
  /** Apply elite drop-shadow glow using the icon's own color. */
  glow?: boolean;
}

export const IconRenderer = ({
  name,
  size = 18,
  strokeWidth = 1.75,
  className,
  color,
  glow = false,
  style,
  ...rest
}: IconRendererProps) => {
  const mergedStyle = {
    ...(color ? { color } : {}),
    ...(glow && color
      ? { filter: `drop-shadow(0 0 6px ${color}aa) drop-shadow(0 0 2px ${color})` }
      : glow
      ? { filter: 'drop-shadow(0 0 6px currentColor)' }
      : {}),
    ...style,
  };

  const fallback = (
    <CircleDot
      size={size}
      strokeWidth={strokeWidth}
      className={cn('shrink-0', className)}
      style={mergedStyle}
      aria-hidden
      {...rest}
    />
  );

  if (!name || typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  if (!trimmed || isLikelyEmoji(trimmed)) return fallback;

  const exact = (icons as Record<string, React.ComponentType<LucideProps>>)[trimmed];
  const ci = iconMap[trimmed.toLowerCase()];
  const kebab = iconMap[kebabToPascal(trimmed).toLowerCase()];
  const Component = exact || ci || kebab;

  if (!Component) return fallback;

  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={cn('shrink-0', className)}
      style={mergedStyle}
      aria-hidden
      {...rest}
    />
  );
};

/** Alias requested by spec — same component, more descriptive name. */
export const DynamicLucideIcon = IconRenderer;

export default IconRenderer;
