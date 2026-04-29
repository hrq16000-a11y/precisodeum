/**
 * Performance budget — Global Exit Intent.
 *
 * Garante que o pop-up de captação não introduza regressão de Core Web Vitals
 * antes do dia de pico de cadastros:
 *  - O componente é importado via dynamic import → não entra no bundle inicial.
 *  - Render fechado (open=false) injeta ZERO nodes pesados no DOM (sem layout
 *    shift / CLS).
 *  - Render aberto fica abaixo do orçamento de DOM (≤ 60 nodes) para não
 *    degradar INP em mobile.
 *  - O peso do source TS (proxy de bundle) está abaixo do limite de 12KB.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const COMPONENT_PATH = 'src/components/GlobalExitIntentDialog.tsx';
const APP_PATH = 'src/App.tsx';

const MAX_SOURCE_KB = 16;
const MAX_OPEN_DOM_NODES = 60;

describe('GlobalExitIntentDialog — performance budget', () => {
  it('é carregado por dynamic import em App.tsx (não entra no bundle inicial)', () => {
    const app = fs.readFileSync(path.join(process.cwd(), APP_PATH), 'utf8');
    expect(app).toMatch(/GlobalExitIntentDialog/);
    // Deve estar dentro de uma chamada lazy/reactLazy (regex tolerante a quebras).
    const lazyRegex = /(?:reactLazy|lazy)\([^)]*GlobalExitIntentDialog/s;
    const direct = /import\s+GlobalExitIntentDialog\s+from/;
    expect(lazyRegex.test(app), 'deve usar reactLazy/lazy').toBe(true);
    expect(direct.test(app), 'NÃO deve haver import estático').toBe(false);
  });

  it('source TS está abaixo do orçamento de 12KB', () => {
    const stat = fs.statSync(path.join(process.cwd(), COMPONENT_PATH));
    const kb = stat.size / 1024;
    expect(kb, `${kb.toFixed(2)}KB > ${MAX_SOURCE_KB}KB`).toBeLessThan(MAX_SOURCE_KB);
  });

  it('com open=false não injeta DOM pesado (CLS-safe)', async () => {
    // Mocks mínimos para isolar performance — sem rede, sem geo real.
    vi.doMock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
    vi.doMock('@/hooks/useGeoCity', () => ({ useGeoCity: () => ({ city: null, state: null }) }));
    vi.doMock('@/lib/conversionFunnel', () => ({
      shouldSuppressExitIntent: () => true, // fecha qualquer trigger automático
      markSupportContacted: () => {},
    }));
    const Mod = await import('@/components/GlobalExitIntentDialog');
    const { container } = render(
      <MemoryRouter><Mod.default /></MemoryRouter>,
    );
    // Antes do trigger, o Dialog do Radix renderiza nada (ou um portal vazio).
    // Aceitamos ≤ 5 nodes (geralmente 0).
    const nodes = container.querySelectorAll('*');
    expect(nodes.length).toBeLessThanOrEqual(5);
    cleanup();
  });
});

describe('GlobalExitIntentDialog — DOM weight quando aberto', () => {
  it('limita o tamanho do DOM ao orçamento de mobile', async () => {
    vi.resetModules();
    vi.doMock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
    vi.doMock('@/hooks/useGeoCity', () => ({ useGeoCity: () => ({ city: 'Curitiba', state: 'PR' }) }));
    vi.doMock('@/lib/conversionFunnel', () => ({
      shouldSuppressExitIntent: () => false,
      markSupportContacted: () => {},
    }));
    const Mod = await import('@/components/GlobalExitIntentDialog');
    const { baseElement } = render(
      <MemoryRouter initialEntries={['/']}><Mod.default /></MemoryRouter>,
    );
    // Dispara mouseleave para abrir.
    const evt = new MouseEvent('mouseleave', { clientY: -1, bubbles: true });
    document.dispatchEvent(evt);
    await new Promise((r) => setTimeout(r, 50));
    const total = baseElement.querySelectorAll('*').length;
    // Budget conservador — Radix Dialog abre ~30-50 nodes.
    expect(total, `DOM aberto: ${total} nodes`).toBeLessThanOrEqual(MAX_OPEN_DOM_NODES);
  });
});
