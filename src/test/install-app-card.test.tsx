/**
 * Integration tests — InstallAppCard ("Instalar app agora")
 *
 * Cobre os três cenários que o botão precisa atender:
 *   1. canInstall = true  → chama `install(source)` (prompt nativo, 1 toque).
 *   2. canInstall = false → dispara `PWA_OPEN_INSTALL_MODAL_EVENT` (fallback
 *      iOS/Safari), abrindo o modal central com instruções manuais.
 *   3. isStandalone = true (app já instalado) → componente NÃO renderiza nada.
 *
 * O hook `usePwaInstallPrompt` é mockado para isolar o comportamento de UI;
 * a lógica do hook em si é coberta por `stability-pwa.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import InstallAppCard from '@/components/onboarding/wizard/InstallAppCard';
import {
  PWA_OPEN_INSTALL_MODAL_EVENT,
} from '@/hooks/usePwaInstall';

// ─── Mock do hook + helpers de telemetria ─────────────────────────────────
const installSpy = vi.fn(async () => true);
const trackSpy = vi.fn();

let mockState = {
  canInstall: false,
  isStandalone: false,
};

vi.mock('@/hooks/usePwaInstall', async () => {
  // Mantém o nome do CustomEvent real para o listener bater.
  return {
    PWA_OPEN_INSTALL_MODAL_EVENT: 'pwa:open-install-modal',
    usePwaInstallPrompt: () => ({
      canInstall: mockState.canInstall,
      isStandalone: mockState.isStandalone,
      install: installSpy,
    }),
    trackPwaEvent: (...args: unknown[]) => trackSpy(...args),
  };
});

beforeEach(() => {
  installSpy.mockClear();
  trackSpy.mockClear();
  mockState = { canInstall: false, isStandalone: false };
  cleanup();
});

describe('InstallAppCard — cenário 1: canInstall = true', () => {
  it('renderiza o botão e chama install() ao clicar', async () => {
    mockState = { canInstall: true, isStandalone: false };

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<InstallAppCard source="test-can-install" />);

    const btn = screen.getByRole('button', { name: /instalar o app agora/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);

    // Aguarda microtask do handler async.
    await Promise.resolve();
    await Promise.resolve();

    expect(installSpy).toHaveBeenCalledTimes(1);
    expect(installSpy).toHaveBeenCalledWith('test-can-install');

    // Não deve disparar o CustomEvent quando o prompt nativo está disponível.
    const fired = dispatchSpy.mock.calls.some(
      ([evt]) => (evt as Event).type === PWA_OPEN_INSTALL_MODAL_EVENT,
    );
    expect(fired).toBe(false);

    dispatchSpy.mockRestore();
  });
});

describe('InstallAppCard — cenário 2: sem beforeinstallprompt (iOS/Safari)', () => {
  it('dispara PWA_OPEN_INSTALL_MODAL_EVENT com a source correta', () => {
    mockState = { canInstall: false, isStandalone: false };

    const handler = vi.fn();
    window.addEventListener(PWA_OPEN_INSTALL_MODAL_EVENT, handler as EventListener);

    render(<InstallAppCard source="ios-fallback" />);

    const btn = screen.getByRole('button', { name: /instalar o app agora/i });
    fireEvent.click(btn);

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0] as CustomEvent;
    expect(evt.type).toBe(PWA_OPEN_INSTALL_MODAL_EVENT);
    expect(evt.detail).toEqual({ source: 'ios-fallback' });

    // Telemetria de clique deve ser registrada mesmo no fallback.
    expect(trackSpy).toHaveBeenCalledWith('cta_click', 'ios-fallback');

    // Não deve chamar o prompt nativo (não existe).
    expect(installSpy).not.toHaveBeenCalled();

    window.removeEventListener(PWA_OPEN_INSTALL_MODAL_EVENT, handler as EventListener);
  });

  it('é fail-soft: clicar não lança mesmo se dispatchEvent falhar', () => {
    mockState = { canInstall: false, isStandalone: false };

    const dispatchSpy = vi
      .spyOn(window, 'dispatchEvent')
      .mockImplementation(() => {
        throw new Error('boom');
      });

    render(<InstallAppCard source="boom-source" />);
    const btn = screen.getByRole('button', { name: /instalar o app agora/i });

    expect(() => fireEvent.click(btn)).not.toThrow();

    dispatchSpy.mockRestore();
  });
});

describe('InstallAppCard — cenário 3: app já instalado (standalone)', () => {
  it('não renderiza nada quando isStandalone = true', () => {
    mockState = { canInstall: false, isStandalone: true };

    const { container } = render(<InstallAppCard source="standalone" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('button', { name: /instalar/i })).toBeNull();
  });

  it('continua oculto mesmo quando canInstall + isStandalone coexistem', () => {
    mockState = { canInstall: true, isStandalone: true };

    const { container } = render(<InstallAppCard />);
    expect(container.firstChild).toBeNull();
  });
});

describe('InstallAppCard — variants', () => {
  it('variant="inline" renderiza apenas o botão (sem moldura)', () => {
    mockState = { canInstall: true, isStandalone: false };

    const { container } = render(<InstallAppCard variant="inline" />);
    // Sem wrapper de gradiente — apenas o <button>.
    expect(container.querySelectorAll('button').length).toBe(1);
    expect(container.querySelector('.rounded-2xl.border-2')).toBeNull();
  });

  it('variant="card" (default) renderiza moldura + título', () => {
    mockState = { canInstall: false, isStandalone: false };

    render(<InstallAppCard />);
    expect(
      screen.getByText(/Instale o app para receber clientes mais rápido/i),
    ).toBeInTheDocument();
  });
});
