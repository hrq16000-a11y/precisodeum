/**
 * GUIA COMERCIAL (guide mode) — configuração declarativa.
 *
 * Modo opcional e desligado por padrão: quando ativo, o portal se comporta
 * como um guia comercial (catálogo + conteúdo + formulário de lead), ocultando
 * recursos que não agregam indexação e aumentam custo (chat, gamificação, etc.).
 *
 * NÃO altera nenhuma regra de backend/RLS — apenas visibilidade de UI.
 * Ativação: VITE_GUIDE_MODE=true (build) ou site_settings.guide_mode_enabled.
 */

export type GuideFeature =
  | 'catalog'
  | 'content_pages'
  | 'lead_form'
  | 'sponsors'
  | 'provider_dashboard'
  | 'chat'
  | 'jobs'
  | 'courses'
  | 'gamification'
  | 'notifications'
  | 'blog';

/** Recursos mantidos no modo guia (tudo que gera indexação ou receita). */
export const GUIDE_MODE_ENABLED_FEATURES: readonly GuideFeature[] = [
  'catalog',
  'content_pages',
  'lead_form',
  'sponsors',
  'blog',
] as const;

/** Recursos desligados no modo guia (custo sem retorno de indexação). */
export const GUIDE_MODE_DISABLED_FEATURES: readonly GuideFeature[] = [
  'provider_dashboard',
  'chat',
  'jobs',
  'courses',
  'gamification',
  'notifications',
] as const;

function envFlag(): boolean {
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | undefined> }).env
      : undefined;
  const raw =
    viteEnv?.VITE_GUIDE_MODE ??
    (typeof process !== 'undefined' && process.env ? process.env.VITE_GUIDE_MODE : undefined);
  return String(raw || '').toLowerCase() === 'true';
}

let runtimeOverride: boolean | null = null;

/**
 * Permite que uma flag remota (site_settings.guide_mode_enabled) sobreponha
 * o valor de build sem exigir novo deploy.
 */
export function setGuideModeOverride(value: boolean | null): void {
  runtimeOverride = value;
}

export function isGuideMode(): boolean {
  return runtimeOverride ?? envFlag();
}

/**
 * Fonte única de verdade para exibir/ocultar um recurso.
 * Fora do modo guia, tudo permanece habilitado (zero impacto no portal atual).
 */
export function isFeatureEnabled(feature: GuideFeature): boolean {
  if (!isGuideMode()) return true;
  return GUIDE_MODE_ENABLED_FEATURES.includes(feature);
}
