/**
 * STABILITY TESTS — BLINDAGEM DA PLATAFORMA
 * 
 * Estes testes protegem os fluxos críticos que já funcionam perfeitamente.
 * NUNCA remova ou altere estes testes sem aprovação explícita.
 * Novos módulos (CRM/CMS) NÃO devem causar falhas aqui.
 */
import { describe, it, expect } from 'vitest';

// ── 1. Verificação de exports críticos ──────────────────────────────
describe('Core exports stability', () => {
  it('exports supabase client', async () => {
    const mod = await import('@/integrations/supabase/client');
    expect(mod.supabase).toBeDefined();
    expect(mod.supabase.auth).toBeDefined();
    expect(mod.supabase.from).toBeTypeOf('function');
  });

  it('exports AuthProvider and useAuth', async () => {
    const mod = await import('@/hooks/useAuth');
    expect(mod.AuthProvider).toBeDefined();
    expect(mod.useAuth).toBeDefined();
  });

  it('exports ProtectedRoute', async () => {
    const mod = await import('@/components/ProtectedRoute');
    expect(mod.default).toBeDefined();
  });

  it('exports useAdmin hook', async () => {
    const mod = await import('@/hooks/useAdmin');
    expect(mod.useAdmin).toBeDefined();
  });
});

// ── 2. Verificação de páginas críticas (lazy imports) ───────────────
describe('Critical page imports', () => {
  const criticalPages = [
    { name: 'Index', path: '@/pages/Index' },
    { name: 'SearchPage', path: '@/pages/SearchPage' },
    { name: 'CategoryPage', path: '@/pages/CategoryPage' },
    { name: 'ProviderProfile', path: '@/pages/ProviderProfile' },
    { name: 'LoginPage', path: '@/pages/LoginPage' },
    { name: 'SignupPage', path: '@/pages/SignupPage' },
    { name: 'DashboardPage', path: '@/pages/DashboardPage' },
    { name: 'DashboardProfilePage', path: '@/pages/DashboardProfilePage' },
    { name: 'AdminPage', path: '@/pages/AdminPage' },
    { name: 'JobsPage', path: '@/pages/JobsPage' },
    { name: 'BlogPage', path: '@/pages/BlogPage' },
  ];

  criticalPages.forEach(({ name, path }) => {
    it(`${name} can be imported without errors`, async () => {
      const mod = await import(/* @vite-ignore */ path);
      expect(mod.default).toBeDefined();
    });
  });
});

// ── 3. Utilitários core ─────────────────────────────────────────────
describe('Core utilities stability', () => {
  it('sanitizeSlug works correctly', async () => {
    const { sanitizeSlug } = await import('@/lib/slugify');
    expect(sanitizeSlug('Olá Mundo')).toBe('ola-mundo');
    expect(sanitizeSlug('  São Paulo  ')).toBe('sao-paulo');
  });

  it('cn utility merges classes', async () => {
    const { cn } = await import('@/lib/utils');
    expect(cn('foo', 'bar')).toContain('foo');
    expect(cn('foo', 'bar')).toContain('bar');
  });

  it('whatsapp link generator works', async () => {
    const { whatsappLink } = await import('@/lib/whatsapp');
    const result = whatsappLink('5511999999999', 'Olá');
    expect(result).toContain('wa.me');
  });

  it('imageOptimizer exports sponsorImage', async () => {
    const mod = await import('@/lib/imageOptimizer');
    expect(mod.sponsorImage).toBeDefined();
  });
});

// ── 4. Componentes de sponsor (blindagem anti-corte) ────────────────
describe('Sponsor components stability', () => {
  it('SponsorImage exports default component', async () => {
    const mod = await import('@/components/SponsorImage');
    expect(mod.default).toBeDefined();
  });

  it('AdBanner exports default component', async () => {
    const mod = await import('@/components/ads/AdBanner');
    expect(mod.default).toBeDefined();
  });

  it('AdShowcase exports default component', async () => {
    const mod = await import('@/components/ads/AdShowcase');
    expect(mod.default).toBeDefined();
  });

  it('SponsorsSection exports default component', async () => {
    const mod = await import('@/components/home/SponsorsSection');
    expect(mod.default).toBeDefined();
  });
});

// ── 5. Layout components ────────────────────────────────────────────
describe('Layout components stability', () => {
  it('Header exports default', async () => {
    const mod = await import('@/components/Header');
    expect(mod.default).toBeDefined();
  });

  it('Footer exports default', async () => {
    const mod = await import('@/components/Footer');
    expect(mod.default).toBeDefined();
  });

  it('DashboardLayout exports default', async () => {
    const mod = await import('@/components/DashboardLayout');
    expect(mod.default).toBeDefined();
  });

  it('AdminLayout exports default', async () => {
    const mod = await import('@/components/AdminLayout');
    expect(mod.default).toBeDefined();
  });
});

// ── 6. Hooks de dados ───────────────────────────────────────────────
describe('Data hooks stability', () => {
  it('useProviders exports correctly', async () => {
    const mod = await import('@/hooks/useProviders');
    expect(mod.useFeaturedProviders).toBeDefined();
  });

  it('useSiteSettings exports correctly', async () => {
    const mod = await import('@/hooks/useSiteSettings');
    expect(mod.useSiteSettings).toBeDefined();
  });

  it('usePrefetch exports correctly', async () => {
    const mod = await import('@/hooks/usePrefetch');
    expect(mod.usePrefetchCategory).toBeDefined();
    expect(mod.usePrefetchProvider).toBeDefined();
  });
});

// ── 7. Database types contract ──────────────────────────────────────
describe('Database schema contract', () => {
  it('types file exports Database type with required tables', async () => {
    const mod = await import('@/integrations/supabase/types');
    expect(mod.Constants.public.Enums.app_role).toContain('admin');
    expect(mod.Constants.public.Enums.app_role).toContain('user');
  });
});
