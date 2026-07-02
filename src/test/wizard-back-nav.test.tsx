/**
 * wizard-back-nav — testes da fonte ÚNICA de navegação "Voltar".
 *
 * Garante:
 *  1. requestWizardBack despacha `wizard:request-prev-unified` com source.
 *  2. Telemetria registra `wizard_back:click`.
 *  3. requestWizardBackFallback dispara `wizard:request-back` (legado) com
 *     `wizard_back:guard_fallback`.
 *  4. BackButton aplica debounce e exibe "Voltando…" com aria-busy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  requestWizardBack,
  requestWizardBackForPhase,
  requestWizardBackFallback,
  WIZARD_BACK_EVENTS,
  WIZARD_BACK_CODES,
} from '@/lib/wizardBackNav';
import { BackButton } from '@/components/onboarding/wizard/BackButton';

const trackedEvents: any[] = [];
vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: vi.fn(async (e) => { trackedEvents.push(e); }),
  setOnboardingIntent: vi.fn(),
}));

describe('wizardBackNav helper', () => {
  beforeEach(() => { trackedEvents.length = 0; });

  it('despacha wizard:request-prev-unified com phase + source', () => {
    const spy = vi.fn();
    window.addEventListener(WIZARD_BACK_EVENTS.PREV_UNIFIED, spy);
    requestWizardBack({ phase: 'phase2_service', source: 'phase2_service' });
    expect(spy).toHaveBeenCalledTimes(1);
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.phase).toBe('phase2_service');
    expect(detail.source).toBe('phase2_service');
    window.removeEventListener(WIZARD_BACK_EVENTS.PREV_UNIFIED, spy);
  });

  it('registra wizard_back:click em onboarding_events', () => {
    requestWizardBack({ phase: 'phase2_service', source: 'phase2_service' });
    const ev = trackedEvents.find((e) => e.meta?.code === WIZARD_BACK_CODES.CLICK);
    expect(ev).toBeTruthy();
    expect(ev.event).toBe('back');
  });

  it('fallback dispara wizard:request-back e marca guard_fallback', () => {
    const spy = vi.fn();
    window.addEventListener(WIZARD_BACK_EVENTS.REQUEST_BACK, spy);
    requestWizardBackFallback({ phase: 'phase4_extras_a', source: 'phase4_extras_a' });
    expect(spy).toHaveBeenCalledTimes(1);
    const ev = trackedEvents.find((e) => e.meta?.code === WIZARD_BACK_CODES.GUARD_FALLBACK);
    expect(ev).toBeTruthy();
    window.removeEventListener(WIZARD_BACK_EVENTS.REQUEST_BACK, spy);
  });

  it('phase2_service fora de revisão usa o evento unificado para voltar à triagem', () => {
    const unifiedSpy = vi.fn();
    const legacySpy = vi.fn();
    window.addEventListener(WIZARD_BACK_EVENTS.PREV_UNIFIED, unifiedSpy);
    window.addEventListener(WIZARD_BACK_EVENTS.REQUEST_BACK, legacySpy);

    requestWizardBackForPhase({ phase: 'phase2_service', source: 'error_modal', editMode: false });

    expect(unifiedSpy).toHaveBeenCalledTimes(1);
    expect(legacySpy).not.toHaveBeenCalled();
    window.removeEventListener(WIZARD_BACK_EVENTS.PREV_UNIFIED, unifiedSpy);
    window.removeEventListener(WIZARD_BACK_EVENTS.REQUEST_BACK, legacySpy);
  });

  it('phase2_service em revisão usa o listener legado do V2 para respeitar a pilha real', () => {
    const unifiedSpy = vi.fn();
    const legacySpy = vi.fn();
    window.addEventListener(WIZARD_BACK_EVENTS.PREV_UNIFIED, unifiedSpy);
    window.addEventListener(WIZARD_BACK_EVENTS.REQUEST_BACK, legacySpy);

    requestWizardBackForPhase({ phase: 'phase2_service', source: 'error_modal', editMode: true });

    expect(legacySpy).toHaveBeenCalledTimes(1);
    expect(unifiedSpy).not.toHaveBeenCalled();
    window.removeEventListener(WIZARD_BACK_EVENTS.PREV_UNIFIED, unifiedSpy);
    window.removeEventListener(WIZARD_BACK_EVENTS.REQUEST_BACK, legacySpy);
  });
});

describe('BackButton UI', () => {
  it('chama onBack uma única vez mesmo com cliques múltiplos rápidos', () => {
    const onBack = vi.fn();
    render(<BackButton onBack={onBack} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('exibe "Voltando…" com aria-busy enquanto processa', () => {
    const onBack = vi.fn();
    render(<BackButton onBack={onBack} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Voltando/i)).toBeInTheDocument();
  });
});
