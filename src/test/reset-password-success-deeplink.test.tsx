import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordSuccessPage from '@/pages/ResetPasswordSuccessPage';
import { buildLoginUrl, sanitizeNextPath } from '@/lib/authRedirect';

/**
 * Deep link após confirmar e-mail / redefinir senha:
 *   /senha-redefinida?next=/dashboard&message=Texto
 *   → CTA "Ir para o login" leva para /login?next=/dashboard&message=Texto
 *
 * Garante que mesmo que o usuário esteja logado ou com sessão expirada,
 * o link preserva o contexto (next + message) para o /login retomar a jornada.
 */

describe('Deep link de redefinição → /login?next=...&message=...', () => {
  it('builda URL preservando next sanitizado e mensagem em pt-BR', () => {
    const url = buildLoginUrl('/dashboard/leads', 'Senha atualizada com sucesso.', 'https://app.test');
    expect(url).toBe('/login?next=%2Fdashboard%2Fleads&message=Senha+atualizada+com+sucesso.');
  });

  it('descarta next absoluto/protocolo (anti open-redirect)', () => {
    expect(sanitizeNextPath('https://evil.com/x', '/dashboard')).toBe('/dashboard');
    expect(sanitizeNextPath('//evil.com', '/dashboard')).toBe('/dashboard');
    expect(sanitizeNextPath(null, '/dashboard')).toBe('/dashboard');
  });

  it('renderiza CTA com next e message preservados na querystring', () => {
    render(
      <MemoryRouter initialEntries={["/senha-redefinida?next=/dashboard/leads&message=Bem-vindo%20de%20volta"]}>
        <ResetPasswordSuccessPage />
      </MemoryRouter>,
    );
    const cta = screen.getByRole('link', { name: /Ir para o login/i });
    expect(cta).toHaveAttribute('href', expect.stringContaining('/login?next='));
    expect(cta.getAttribute('href')).toContain('next=%2Fdashboard%2Fleads');
    expect(cta.getAttribute('href')).toContain('message=Bem-vindo');
  });

  it('usa mensagem padrão pt-BR quando não houver ?message', () => {
    render(
      <MemoryRouter initialEntries={["/senha-redefinida"]}>
        <ResetPasswordSuccessPage />
      </MemoryRouter>,
    );
    const cta = screen.getByRole('link', { name: /Ir para o login/i });
    expect(cta.getAttribute('href')).toMatch(/message=/);
    // Garante cópia pt-BR padrão
    expect(decodeURIComponent(cta.getAttribute('href') || '')).toMatch(/Senha atualizada com sucesso/i);
  });
});
