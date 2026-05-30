/**
 * Defaults de layout do Dashboard por tipo de perfil.
 * Estes IDs precisam casar com os IDs renderizados em DashboardPage.tsx
 * (mapa de seções `providerSectionRegistry`).
 *
 * O admin controla ordem/visibilidade via /admin/dashboard-layout,
 * persistido em `site_settings` (chaves `dashboard_layout_<type>`).
 */

export type DashboardLayoutItem = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
};

export type DashboardProfileType = 'provider' | 'rh' | 'client' | 'sponser';

export const DASHBOARD_LAYOUT_KEYS: Record<DashboardProfileType, string> = {
  provider: 'dashboard_layout_provider',
  rh: 'dashboard_layout_rh',
  client: 'dashboard_layout_client',
  sponser: 'dashboard_layout_sponser',
};

const provider: DashboardLayoutItem[] = [
  { id: 'welcome_hero', label: 'Boas-vindas (Hero)', visible: true, order: 1 },
  { id: 'quick_actions_hero', label: 'Ações Rápidas', visible: true, order: 2 },
  { id: 'onboarding_completion_tracker', label: 'Tracker de Onboarding', visible: true, order: 3 },
  { id: 'unified_health_score', label: 'Score de Completude', visible: true, order: 4 },
  { id: 'daily_post_card', label: 'Obra do Dia', visible: true, order: 5 },
  { id: 'metrics_preview', label: 'Prévia de Métricas', visible: true, order: 6 },
  { id: 'online_status_feedback', label: 'Status Online (feedback)', visible: true, order: 7 },
  { id: 'online_status_toggle', label: 'Toggle Online/Offline', visible: true, order: 8 },
  { id: 'pwa_install_nudge', label: 'Instalar App (PWA)', visible: true, order: 9 },
  { id: 'mission_card', label: 'Missões', visible: true, order: 10 },
  { id: 'identity_suggestions', label: 'Sugestões de Identidade', visible: true, order: 11 },
  { id: 'service_completion_card', label: 'Ciclo de Fechamento', visible: true, order: 12 },
  { id: 'engagement_loop', label: 'Engagement Loop', visible: true, order: 13 },
  { id: 'empty_banners', label: 'Banners de Estado Vazio', visible: true, order: 14 },
  { id: 'smart_cta_or_checklist', label: 'CTA Inteligente / Checklist', visible: true, order: 15 },
  { id: 'expert_tips', label: 'Dica de Especialista', visible: true, order: 16 },
  { id: 'lead_followup', label: 'Follow-up de Leads', visible: true, order: 17 },
  { id: 'insights_collapsible', label: 'Insights (colapsável)', visible: true, order: 18 },
  { id: 'share_profile_card', label: 'Compartilhar Perfil + QR', visible: true, order: 19 },
  { id: 'courses_banner', label: 'Banner de Cursos', visible: true, order: 20 },
  { id: 'quick_stats_bar', label: 'Barra de Stats Rápidas', visible: true, order: 21 },
  { id: 'action_queue', label: 'Fila de Ações', visible: true, order: 22 },
  { id: 'tip_and_benefits', label: 'Dica do Dia + Benefícios do Nível', visible: true, order: 23 },
  { id: 'quick_access', label: 'Acesso Rápido', visible: true, order: 24 },
  { id: 'onboarding_stepper', label: 'Guia de Onboarding (Stepper)', visible: true, order: 25 },
  { id: 'missed_opportunities', label: 'Oportunidades Perdidas', visible: true, order: 26 },
  { id: 'referral_invite', label: 'Convite de Indicação', visible: true, order: 27 },
  { id: 'our_story_banner', label: 'Banner — Nossa História', visible: true, order: 28 },
];

const rh: DashboardLayoutItem[] = [
  { id: 'main_section', label: 'Dashboard RH (bloco principal)', visible: true, order: 1 },
];

const client: DashboardLayoutItem[] = [
  { id: 'main_section', label: 'Dashboard Cliente (bloco principal)', visible: true, order: 1 },
];

const sponser: DashboardLayoutItem[] = [
  { id: 'main_section', label: 'Dashboard Patrocinador (bloco principal)', visible: true, order: 1 },
];

export const DEFAULT_DASHBOARD_LAYOUTS: Record<DashboardProfileType, DashboardLayoutItem[]> = {
  provider,
  rh,
  client,
  sponser,
};

/**
 * Merge defaults com valor salvo. Garante que novas seções adicionadas
 * em código (mas ainda não persistidas) aparecem ao final, visíveis,
 * sem quebrar o dashboard.
 */
export function mergeWithDefaults(
  type: DashboardProfileType,
  saved: DashboardLayoutItem[] | null | undefined,
): DashboardLayoutItem[] {
  const defaults = DEFAULT_DASHBOARD_LAYOUTS[type] || [];
  if (!saved || !Array.isArray(saved) || saved.length === 0) {
    return defaults.map((d) => ({ ...d }));
  }
  const byId = new Map(saved.map((s) => [s.id, s]));
  const merged: DashboardLayoutItem[] = [];

  saved
    .filter((s) => defaults.some((d) => d.id === s.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .forEach((s, idx) => {
      const def = defaults.find((d) => d.id === s.id)!;
      merged.push({
        id: s.id,
        label: def.label,
        visible: typeof s.visible === 'boolean' ? s.visible : true,
        order: idx + 1,
      });
    });

  let next = merged.length + 1;
  defaults.forEach((d) => {
    if (!byId.has(d.id)) {
      merged.push({ ...d, order: next++ });
    }
  });

  return merged;
}
