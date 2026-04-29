/**
 * Garante que /ajuda/cadastro emite JSON-LD do tipo FAQPage com as 8
 * perguntas reais do componente — protege os rich snippets do Google.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useSiteSettings', () => ({
  useSettingValue: () => null,
}));

import HelpOnboardingPage from '@/pages/HelpOnboardingPage';

function readFaqJsonLd(): any | null {
  const scripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  ) as HTMLScriptElement[];
  for (const s of scripts) {
    try {
      const json = JSON.parse(s.textContent || '');
      if (json?.['@type'] === 'FAQPage') return json;
    } catch {
      /* ignore */
    }
  }
  return null;
}

describe('HelpOnboardingPage — FAQPage JSON-LD', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    sessionStorage.clear();
  });

  it('injeta um <script type="application/ld+json"> do tipo FAQPage', async () => {
    render(
      <MemoryRouter>
        <HelpOnboardingPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const ld = readFaqJsonLd();
      expect(ld).toBeTruthy();
      expect(ld['@context']).toBe('https://schema.org');
      expect(ld['@type']).toBe('FAQPage');
    });
  });

  it('contém todas as perguntas (mainEntity ≥ 8) com Question + Answer', async () => {
    render(
      <MemoryRouter>
        <HelpOnboardingPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const ld = readFaqJsonLd();
      expect(Array.isArray(ld.mainEntity)).toBe(true);
      expect(ld.mainEntity.length).toBeGreaterThanOrEqual(8);
      for (const q of ld.mainEntity) {
        expect(q['@type']).toBe('Question');
        expect(typeof q.name).toBe('string');
        expect(q.name.length).toBeGreaterThan(0);
        expect(q.acceptedAnswer?.['@type']).toBe('Answer');
        expect(typeof q.acceptedAnswer?.text).toBe('string');
      }
    });
  });

  it('inclui perguntas-chave esperadas (CPF/CNPJ, WhatsApp, gratuito)', async () => {
    render(
      <MemoryRouter>
        <HelpOnboardingPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      const ld = readFaqJsonLd();
      const text = ld.mainEntity.map((q: any) => q.name).join(' | ');
      expect(text).toMatch(/CPF|CNPJ/i);
      expect(text).toMatch(/WhatsApp/i);
      expect(text).toMatch(/pagar|gratuito|grátis/i);
    });
  });
});
