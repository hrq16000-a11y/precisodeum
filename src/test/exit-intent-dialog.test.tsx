/**
 * exit-intent-dialog.test.tsx — valida comportamento e telemetria do
 * ExitIntentDialog: aparece uma única vez por sessão, registra evento ao
 * abrir, ao clicar em WhatsApp e ao dispensar.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExitIntentDialog from '@/components/onboarding/wizard/ExitIntentDialog';
import { setSessionVariantForTest } from '@/lib/exitIntentVariants';
import {
  markHelpPageVisited,
  markSupportContacted,
  resetConversionFunnelForTest,
} from '@/lib/conversionFunnel';

const STORAGE_KEY = 'wizard:exit-intent-shown';

function renderDialog(props: Partial<React.ComponentProps<typeof ExitIntentDialog>> = {}) {
  const tracker = vi.fn();
  const utils = render(
    <MemoryRouter>
      <ExitIntentDialog
        phase="triage_identity"
        intent="professional"
        variantOverride="A"
        tracker={tracker}
        inactivityMs={50}
        {...props}
      />
    </MemoryRouter>,
  );
  return { ...utils, tracker };
}

function fireMouseLeaveTop() {
  const ev = new MouseEvent('mouseleave', { bubbles: true, clientY: 0 });
  document.dispatchEvent(ev);
}

describe('ExitIntentDialog', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetConversionFunnelForTest();
    setSessionVariantForTest('A');
    // window.open mock — evita popup real
    (window as any).open = vi.fn();
    vi.useRealTimers();
  });

  it('abre via mouseleave pelo topo e registra exit_intent_shown', async () => {
    const { tracker } = renderDialog();
    await act(async () => {
      fireMouseLeaveTop();
    });
    expect(screen.getByTestId('exit-intent-dialog')).toBeInTheDocument();
    expect(tracker).toHaveBeenCalledWith(
      'exit_intent_shown',
      expect.objectContaining({
        source: 'mouseleave',
        variant: 'A',
        phase_group: 'triage',
        intent: 'professional',
      }),
    );
  });

  it('abre via inatividade após o timeout', async () => {
    vi.useFakeTimers();
    const { tracker } = renderDialog({ inactivityMs: 100 });
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(tracker).toHaveBeenCalledWith(
      'exit_intent_shown',
      expect.objectContaining({ source: 'inactivity' }),
    );
    vi.useRealTimers();
  });

  it('aparece apenas UMA vez por sessão (mouseleave repetido não reabre)', async () => {
    const { tracker, unmount } = renderDialog();
    await act(async () => fireMouseLeaveTop());
    expect(tracker).toHaveBeenCalledTimes(1);

    // dispensa e desmonta, simula nova navegação interna
    fireEvent.click(screen.getByTestId('exit-intent-dismiss'));
    unmount();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('1');

    // remonta — não deve disparar de novo
    const { tracker: tracker2 } = renderDialog();
    await act(async () => fireMouseLeaveTop());
    expect(tracker2).not.toHaveBeenCalledWith(
      'exit_intent_shown',
      expect.anything(),
    );
  });

  it('clique em WhatsApp registra evento e abre wa.me em nova aba', async () => {
    const { tracker } = renderDialog();
    await act(async () => fireMouseLeaveTop());
    fireEvent.click(screen.getByTestId('exit-intent-whatsapp'));

    expect(tracker).toHaveBeenCalledWith(
      'exit_intent_whatsapp',
      expect.objectContaining({ variant: 'A', intent: 'professional', phase_group: 'triage' }),
    );
    expect(window.open).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/5541997452053\?text=/),
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('clique em Dispensar registra exit_intent_dismiss e fecha o diálogo', async () => {
    const { tracker } = renderDialog();
    await act(async () => fireMouseLeaveTop());
    fireEvent.click(screen.getByTestId('exit-intent-dismiss'));

    expect(tracker).toHaveBeenCalledWith(
      'exit_intent_dismiss',
      expect.objectContaining({ variant: 'A', phase_group: 'triage', intent: 'professional' }),
    );
    expect(screen.queryByTestId('exit-intent-dialog')).not.toBeInTheDocument();
  });

  it('intent=client renderiza copy de busca em vez de cadastro', async () => {
    renderDialog({ intent: 'client' });
    await act(async () => fireMouseLeaveTop());
    const dialog = screen.getByTestId('exit-intent-dialog');
    expect(dialog.textContent?.toLowerCase()).toMatch(/encontrar|profissional|indica/);
  });

  it('é suprimido se o usuário JÁ contatou suporte (markSupportContacted)', async () => {
    markSupportContacted({ source: 'help_page' });
    const { tracker } = renderDialog();
    await act(async () => fireMouseLeaveTop());
    expect(screen.queryByTestId('exit-intent-dialog')).not.toBeInTheDocument();
    expect(tracker).not.toHaveBeenCalledWith('exit_intent_shown', expect.anything());
  });

  it('é suprimido se o usuário JÁ visitou /ajuda/cadastro (markHelpPageVisited)', async () => {
    markHelpPageVisited();
    const { tracker } = renderDialog();
    await act(async () => fireMouseLeaveTop());
    expect(screen.queryByTestId('exit-intent-dialog')).not.toBeInTheDocument();
    expect(tracker).not.toHaveBeenCalledWith('exit_intent_shown', expect.anything());
  });

  it('NÃO mostra "Salvar e continuar mais tarde" sem firstService', async () => {
    renderDialog({ phase: 'main_service', hasFirstService: false });
    await act(async () => fireMouseLeaveTop());
    expect(screen.queryByTestId('exit-intent-save-later')).not.toBeInTheDocument();
  });

  it('mostra "Salvar e continuar mais tarde" quando hasFirstService=true e dispara exit_intent_save_later', async () => {
    const { tracker } = renderDialog({ phase: 'main_service', hasFirstService: true });
    await act(async () => fireMouseLeaveTop());
    const btn = screen.getByTestId('exit-intent-save-later');
    expect(btn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(tracker).toHaveBeenCalledWith(
      'exit_intent_save_later',
      expect.objectContaining({ has_first_service: true, phase: 'main_service' }),
    );
  });

  it('exibe título "Não vá ainda!" no grupo main quando profissional sem firstService', async () => {
    renderDialog({ phase: 'main_service', hasFirstService: false, intent: 'professional' });
    await act(async () => fireMouseLeaveTop());
    expect(screen.getByText('Não vá ainda!')).toBeInTheDocument();
    expect(screen.getByText(/ainda não publicou seu serviço/i)).toBeInTheDocument();
  });
});
