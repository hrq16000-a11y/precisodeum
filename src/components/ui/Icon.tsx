import { forwardRef } from 'react';
import { type LucideIcon, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Standardised icon sizes used across the platform.
 * All icons render as inline SVG with viewBox="0 0 24 24",
 * stroke="currentColor", fill="none", strokeLinecap/join="round".
 */
const SIZE_MAP = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
} as const;

export type IconSize = keyof typeof SIZE_MAP | number;

export interface IconProps extends Omit<LucideProps, 'size' | 'ref'> {
  /** Lucide icon component – e.g. `Search` from lucide-react */
  icon: LucideIcon;
  /** Preset token or pixel number. Defaults to 'md' (24px). */
  size?: IconSize;
  /**
   * Accessible label. When provided the icon gets `role="img"` and
   * an internal `<title>`. When omitted the icon is decorative
   * (`aria-hidden="true"`).
   */
  label?: string;
}

/**
 * Unified icon wrapper that enforces platform-wide visual consistency.
 *
 * ```tsx
 * import { Search } from 'lucide-react';
 * <Icon icon={Search} size="sm" />
 * <Icon icon={Search} size="lg" label="Buscar" />
 * ```
 */
const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideIcon, size = 'md', label, className, ...rest }, ref) => {
    const px = typeof size === 'number' ? size : SIZE_MAP[size];

    // Accessibility: decorative vs informative
    const a11y: Record<string, unknown> = label
      ? { role: 'img', 'aria-label': label }
      : { 'aria-hidden': true };

    return (
      <LucideIcon
        ref={ref}
        size={px}
        strokeWidth={1.75}
        className={cn('shrink-0', className)}
        {...a11y}
        {...rest}
      />
    );
  },
);

Icon.displayName = 'Icon';

export { Icon, SIZE_MAP };
export default Icon;
