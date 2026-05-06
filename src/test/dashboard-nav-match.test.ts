import { describe, it, expect } from 'vitest';
import { isDashboardNavItemActive } from '@/lib/dashboardNavMatch';

describe('isDashboardNavItemActive — Meus Contatos & friends', () => {
  const path = '/dashboard/cliente/contatos';

  it('matches exact route', () => {
    expect(isDashboardNavItemActive('/dashboard/cliente/contatos', path)).toBe(true);
  });

  it('matches with trailing slash', () => {
    expect(isDashboardNavItemActive('/dashboard/cliente/contatos/', path)).toBe(true);
  });

  it('matches subroutes (e.g. detalhe)', () => {
    expect(isDashboardNavItemActive('/dashboard/cliente/contatos/abc-123', path)).toBe(true);
    expect(isDashboardNavItemActive('/dashboard/cliente/contatos/abc/edit', path)).toBe(true);
  });

  it('does not match unrelated routes', () => {
    expect(isDashboardNavItemActive('/dashboard/perfil', path)).toBe(false);
    expect(isDashboardNavItemActive('/dashboard/cliente', path)).toBe(false);
    expect(isDashboardNavItemActive('/dashboard/cliente/contatos-old', path)).toBe(false);
  });

  it('does not let /dashboard match every nested dashboard route', () => {
    expect(isDashboardNavItemActive('/dashboard/cliente/contatos', '/dashboard')).toBe(false);
    expect(isDashboardNavItemActive('/dashboard', '/dashboard')).toBe(true);
    expect(isDashboardNavItemActive('/dashboard/', '/dashboard')).toBe(true);
  });

  it('handles empty inputs safely', () => {
    expect(isDashboardNavItemActive('', path)).toBe(false);
    expect(isDashboardNavItemActive('/dashboard', '')).toBe(false);
  });
});
