/**
 * Valida que /ajuda/cadastro renderiza title/description/canonical
 * via useSeoHead, garantindo SEO consistente e testável.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useSiteSettings', () => ({
  useSettingValue: () => null,
}));

import HelpOnboardingPage from '@/pages/HelpOnboardingPage';

describe('HelpOnboardingPage — SEO via useSeoHead', () => {
  beforeEach(() => {
    document.title = '';
    document.head.innerHTML = '';
    sessionStorage.clear();
  });

  it('aplica title contendo "Ajuda do Cadastro" e o sufixo de marca', async () => {
    render(
      <MemoryRouter>
        <HelpOnboardingPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(document.title).toMatch(/Ajuda do Cadastro/i);
      expect(document.title).toMatch(/Preciso de um/i);
    });
  });

  it('grava meta description e canonical absolutos para /ajuda/cadastro', async () => {
    render(
      <MemoryRouter>
        <HelpOnboardingPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      expect(desc?.content.toLowerCase()).toMatch(/cadastro|suporte|whatsapp/);
      expect(canonical?.href).toMatch(/\/ajuda\/cadastro$/);
    });
  });
});
