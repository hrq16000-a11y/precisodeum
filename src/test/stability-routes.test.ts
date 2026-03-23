/**
 * ROUTE INTEGRITY TESTS — BLINDAGEM DE ROTAS
 * 
 * Garante que todas as rotas críticas existem e seus componentes
 * podem ser importados. Novos módulos NÃO devem remover rotas existentes.
 */
import { describe, it, expect } from 'vitest';

// Snapshot of all routes that MUST exist
const PROTECTED_ROUTES = [
  '/',
  '/buscar',
  '/login',
  '/cadastro',
  '/vagas',
  '/dashboard',
  '/dashboard/perfil',
  '/dashboard/servicos',
  '/dashboard/avaliacoes',
  '/dashboard/leads',
  '/dashboard/plano',
  '/dashboard/minha-pagina',
  '/dashboard/vagas',
  '/dashboard/comunidade',
  '/admin',
  '/admin/prestadores',
  '/admin/avaliacoes',
  '/admin/usuarios',
  '/admin/categorias',
  '/admin/estatisticas',
  '/admin/cidades',
  '/admin/configuracoes',
  '/admin/patrocinadores',
  '/admin/servicos-populares',
  '/admin/faq',
  '/admin/metatags',
  '/admin/destaques',
  '/admin/comunidade',
  '/admin/vagas',
  '/admin/blog',
  '/blog',
  '/faq',
  '/sobre',
  '/reset-password',
] as const;

describe('Route registry integrity', () => {
  it('App.tsx contains all protected routes', async () => {
    // Read the App module to verify route strings
    const fs = await import('fs');
    const appContent = fs.readFileSync('src/App.tsx', 'utf-8');

    for (const route of PROTECTED_ROUTES) {
      expect(
        appContent.includes(`path="${route}"`) || appContent.includes(`path="${route.slice(1)}"`),
        `Route "${route}" must exist in App.tsx`
      ).toBe(true);
    }
  });

  it('no protected route was accidentally removed', () => {
    // This test acts as a regression guard
    expect(PROTECTED_ROUTES.length).toBeGreaterThanOrEqual(33);
  });
});
