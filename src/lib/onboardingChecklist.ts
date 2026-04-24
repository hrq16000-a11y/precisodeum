/**
 * onboardingChecklist.ts — ÚNICA fonte da verdade para a esteira de
 * completude do prestador. Compartilhado por:
 *   • FirstLeadChecklist  (CTA do dashboard)
 *   • ProfileCompleteness (resumo do dashboard)
 *   • SmartOnboardingWizard (Step 4 — gate de portfolio)
 *   • OnboardingGate (App.tsx — bloqueia /dashboard)
 *
 * Regra atual (alinhada à exigência do banco + nova esteira):
 *   1. Foto de perfil
 *   2. WhatsApp / Telefone
 *   3. Cidade + Estado
 *   4. Descrição ≥ 30 caracteres
 *   5. Pelo menos 1 serviço cadastrado
 *   6. Pelo menos 1 álbum de portfólio
 */

export interface ChecklistItem {
  key: 'photo' | 'contact' | 'location' | 'description' | 'service' | 'portfolio';
  label: string;
  hint: string;
  done: boolean;
  href: string;
  /** Se true, é exigência ESTRUTURAL — sem ele o gate não libera o dashboard. */
  structural: boolean;
}

interface CompletenessInput {
  profile?: any;
  provider?: any;
  servicesCount?: number;
  portfolioAlbumsCount?: number;
}

export const buildOnboardingChecklist = (input: CompletenessInput): ChecklistItem[] => {
  const { profile, provider, servicesCount, portfolioAlbumsCount } = input;

  const hasPhoto = !!(provider?.photo_url || profile?.avatar_url);
  const hasContact = !!(profile?.whatsapp || profile?.phone || provider?.whatsapp || provider?.phone);
  const hasLocation = !!(provider?.city && provider.city !== 'Não informada' && provider?.state);
  const hasDescription = !!(provider?.description && provider.description.length >= 30);
  const services = typeof servicesCount === 'number' ? servicesCount : (provider?.services_count ?? 0);
  const albums = typeof portfolioAlbumsCount === 'number' ? portfolioAlbumsCount : (provider?.portfolio_album_count ?? 0);
  const hasService = services >= 1;
  const hasPortfolio = albums >= 1;

  return [
    { key: 'photo', label: 'Foto de perfil', hint: 'Adicione uma foto profissional', done: hasPhoto, href: '/dashboard/perfil', structural: false },
    { key: 'contact', label: 'WhatsApp / Telefone', hint: 'Cadastre seu contato direto', done: hasContact, href: '/dashboard/perfil', structural: true },
    { key: 'location', label: 'Cidade e estado', hint: 'Defina onde você atende', done: hasLocation, href: '/dashboard/perfil', structural: true },
    { key: 'description', label: 'Descrição (≥30 caracteres)', hint: 'Conte o que você faz de melhor', done: hasDescription, href: '/dashboard/perfil', structural: false },
    { key: 'service', label: 'Pelo menos 1 serviço', hint: 'Cadastre o que você oferece', done: hasService, href: '/dashboard/servicos', structural: true },
    { key: 'portfolio', label: 'Pelo menos 1 álbum de portfólio', hint: 'Mostre seu trabalho com fotos reais', done: hasPortfolio, href: '/dashboard/portfolio', structural: false },
  ];
};

export const checklistStats = (items: ChecklistItem[]) => {
  const total = items.length;
  const completed = items.filter(i => i.done).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const firstMissing = items.find(i => !i.done) ?? null;
  const structuralMissing = items.filter(i => i.structural && !i.done);
  const allStructuralDone = structuralMissing.length === 0;
  return { total, completed, pct, firstMissing, structuralMissing, allStructuralDone };
};
