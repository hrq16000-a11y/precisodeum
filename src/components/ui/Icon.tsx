import { forwardRef } from 'react';
import { type LucideIcon, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Standardised icon sizes used across the platform.
 *
 * Context → Size mapping:
 *  - Navigation / Cards / inline text → sm (20px)
 *  - Buttons (CTA) / default         → md (24px)
 *  - Premium highlights / hero        → lg (32px)
 *  - Tiny badges / metadata           → xs (16px)
 */
const SIZE_MAP = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
} as const;

export type IconSize = keyof typeof SIZE_MAP | number;

/**
 * Visual state of the icon.
 *  - `default`  – normal rendering
 *  - `hover`    – subtle color shift (applied via CSS class)
 *  - `active`   – pressed scale-down
 *  - `disabled` – dimmed, no pointer events
 *  - `loading`  – spinning animation
 */
export type IconState = 'default' | 'hover' | 'active' | 'disabled' | 'loading';

export interface IconProps extends Omit<LucideProps, 'size' | 'ref'> {
  /** Lucide icon component – e.g. `Search` from lucide-react */
  icon: LucideIcon;
  /** Preset token or pixel number. Defaults to 'md' (24px). */
  size?: IconSize;
  /**
   * Accessible label. When provided the icon gets `role="img"` and
   * aria-label. When omitted the icon is decorative (`aria-hidden`).
   */
  label?: string;
  /**
   * Visual state – adds micro-interaction classes.
   * Most of the time you won't set this manually; the CSS utility
   * classes on parent elements handle hover/active automatically.
   */
  state?: IconState;
  /**
   * Enable the platform signature micro-interaction:
   * subtle translateY + opacity shift on hover.
   * Applied via the `.icon-interactive` CSS class.
   */
  interactive?: boolean;
}

/** State → Tailwind class mapping */
const STATE_CLASSES: Record<IconState, string> = {
  default: '',
  hover: 'icon-state-hover',
  active: 'icon-state-active',
  disabled: 'icon-state-disabled',
  loading: 'icon-state-loading',
};

/**
 * Unified icon wrapper that enforces platform-wide visual consistency.
 *
 * ```tsx
 * import { Search, Loader2 } from 'lucide-react';
 *
 * // Basic
 * <Icon icon={Search} size="sm" />
 *
 * // With accessibility label
 * <Icon icon={Search} size="lg" label="Buscar" />
 *
 * // Interactive (micro-interaction on hover)
 * <Icon icon={Search} interactive />
 *
 * // Loading state
 * <Icon icon={Loader2} state="loading" />
 * ```
 */
const Icon = forwardRef<SVGSVGElement, IconProps>(
  (
    {
      icon: LucideIcon,
      size = 'md',
      label,
      state = 'default',
      interactive = false,
      className,
      ...rest
    },
    ref,
  ) => {
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
        className={cn(
          'shrink-0 icon-base',
          STATE_CLASSES[state],
          interactive && 'icon-interactive',
          className,
        )}
        {...a11y}
        {...rest}
      />
    );
  },
);

Icon.displayName = 'Icon';

export { Icon, SIZE_MAP };
export default Icon;
