/**
 * DEPRECATED (Soft Deprecation): Platform is 100% free.
 * Always returns 'none' — no upsell prompts.
 */
export type UpsellLevel = 'none' | 'warning' | 'critical';

export interface UpsellState {
  level: UpsellLevel;
  servicesPct: number | null;
  leadsPct: number | null;
  trigger: 'services' | 'leads' | null;
  message: string | null;
  isPremium: boolean;
  loading: boolean;
}

export const useUpsellTrigger = (): UpsellState => ({
  level: 'none',
  servicesPct: null,
  leadsPct: null,
  trigger: null,
  message: null,
  isPremium: true,
  loading: false,
});
