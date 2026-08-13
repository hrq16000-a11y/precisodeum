/**
 * Cobertura de motion/loading nas telas autenticadas (dashboard, perfil e leads)
 * e no perfil público do profissional (/profissional/:slug).
 *
 * Checagens estáticas (rápidas, sem render pesado) que impedem regressão para
 * "Carregando..." em texto puro ou tela em branco.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const SCREENS = [
  { route: '/dashboard', file: 'src/pages/DashboardPage.tsx', testId: 'dashboard-loading' },
  { route: '/dashboard/perfil', file: 'src/pages/DashboardProfilePage.tsx', testId: 'dashboard-profile-loading' },
  { route: '/dashboard/leads', file: 'src/pages/DashboardLeadsPage.tsx', testId: 'leads-loading' },
  { route: '/dashboard/leads/:id', file: 'src/pages/DashboardLeadDetailPage.tsx', testId: 'lead-detail-loading' },
  { route: '/profissional/:slug', file: 'src/pages/ProviderProfile.tsx', testId: 'provider-loading' },
];

describe('Dashboard, leads e perfil público · motion e loading', () => {
  for (const { route, file, testId } of SCREENS) {
    const src = read(file);

    it(`${route} renderiza skeleton identificável durante o carregamento`, () => {
      expect(src).toContain(`data-testid="${testId}"`);
      expect(/Skeleton/.test(src)).toBe(true);
    });

    it(`${route} exibe ProgressIndicator do design system`, () => {
      expect(src).toContain('ProgressIndicator');
    });

    it(`${route} não usa mais texto cru "Carregando..." como estado de loading`, () => {
      expect(src).not.toContain('>Carregando...<');
    });

    it(`${route} usa animação de entrada do design system`, () => {
      expect(/motion-enter|motion-stagger/.test(src)).toBe(true);
    });
  }

  it('detalhe do lead trata "não encontrado" sem tela em branco', () => {
    const src = read('src/pages/DashboardLeadDetailPage.tsx');
    expect(src).toContain('Lead não encontrado');
  });

  it('perfil público trata profissional inexistente com noindex e CTA de volta', () => {
    const src = read('src/pages/ProviderProfile.tsx');
    expect(src).toContain('Profissional não encontrado');
    expect(src).toContain('noindex');
  });

  it('formulário de solicitação (lead) mostra progresso ao enviar', () => {
    const src = read('src/pages/ProviderProfile.tsx');
    expect(src).toContain('isSubmittingLead');
    expect(src).toMatch(/isSubmittingLead && \(\s*<ProgressIndicator/);
  });

  it('fallbacks de seções lazy usam shimmer (não pulse) e reservam altura', () => {
    for (const f of [
      'src/pages/dashboard/sections/_skeleton.tsx',
      'src/pages/provider-profile/sections/_skeleton.tsx',
    ]) {
      const src = read(f);
      expect(src).toContain('skeleton-shimmer');
      expect(src).not.toContain('animate-pulse');
      expect(src).toContain('min-h');
    }
  });
});
