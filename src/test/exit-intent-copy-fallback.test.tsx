/**
 * GlobalExitIntentDialog — copy + telemetria + fallback geo.
 *
 * Cobre as regras de negócio do dia de pico:
 *  - NUNCA usa a palavra "verificado" (constraint legal).
 *  - Sempre tem CTA primário direto para /cadastro (sem redirecionamento).
 *  - Quando NÃO há cidade, exibe mensagem cordial sem quebrar layout.
 *  - Personaliza com bairro+cidade quando disponível.
 *  - Fala em "Profissional top" e "rede nacional".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/components/GlobalExitIntentDialog.tsx'),
  'utf8',
);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/conversionFunnel', () => ({
  shouldSuppressExitIntent: () => false,
  markSupportContacted: vi.fn(),
}));

describe('GlobalExitIntentDialog — constraints', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('NUNCA contém a palavra "verificado" (constraint legal)', () => {
    expect(/verificad/i.test(SRC)).toBe(false);
  });

  it('todos os CTAs primários apontam direto para /cadastro (sem redirect)', () => {
    // Match para `primaryHref: '/cadastro...'` em todos os branches da copy.
    const matches = SRC.match(/primaryHref:\s*'\/cadastro[^']*'/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it('contém vocabulário "Profissional top" / "rede nacional"', () => {
    expect(/Profissional top/i.test(SRC)).toBe(true);
    expect(/rede nacional/i.test(SRC)).toBe(true);
  });

  it('fallback sem cidade usa "todo o Brasil" / "rede nacional" (não quebra)', () => {
    expect(SRC).toMatch(/todo o Brasil/);
    expect(SRC).toMatch(/'\s*na nossa rede nacional\s*'/);
  });
});

describe('GlobalExitIntentDialog — render fallback (sem cidade)', () => {
  beforeEach(() => { sessionStorage.clear(); cleanup(); });

  it('renderiza CTA "Quero me cadastrar grátis" sem cidade detectada', async () => {
    vi.doMock('@/hooks/useGeoCity', () => ({
      useGeoCity: () => ({ city: null, state: null, neighborhood: null }),
    }));
    const Mod = await import('@/components/GlobalExitIntentDialog');
    render(<MemoryRouter initialEntries={['/']}><Mod.default /></MemoryRouter>);
    document.dispatchEvent(new MouseEvent('mouseleave', { clientY: -1, bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId('global-exit-intent-primary')).toBeTruthy();
    // Não menciona "undefined" nem strings vazias mal formatadas.
    expect(document.body.innerHTML).not.toMatch(/undefined|\bnull\b/);
  });
});
