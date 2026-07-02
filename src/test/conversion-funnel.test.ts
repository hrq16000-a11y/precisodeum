import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  markHelpPageVisited,
  markSupportContacted,
  resetConversionFunnelForTest,
  shouldSuppressExitIntent,
} from '@/lib/conversionFunnel';

vi.mock('@/components/onboarding/wizard/phases/v2/telemetry', () => ({
  trackOnboardingEvent: vi.fn(),
}));

import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';

describe('conversionFunnel', () => {
  beforeEach(() => {
    resetConversionFunnelForTest();
    (trackOnboardingEvent as any).mockClear();
  });

  it('shouldSuppressExitIntent começa false', () => {
    expect(shouldSuppressExitIntent()).toBe(false);
  });

  it('markSupportContacted suprime exit-intent e registra evento com source/intent/phase', () => {
    markSupportContacted({
      source: 'exit_intent',
      intent: 'professional',
      phase: 'main_service',
      variant: 'B',
    });
    expect(shouldSuppressExitIntent()).toBe(true);
    expect(trackOnboardingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'support_whatsapp_clicked',
        phase: 'main_service',
        meta: expect.objectContaining({
          source: 'exit_intent',
          intent: 'professional',
          variant: 'B',
        }),
      }),
    );
  });

  it('markHelpPageVisited suprime exit-intent e registra help_page_visited', () => {
    markHelpPageVisited({ intent: 'client' });
    expect(shouldSuppressExitIntent()).toBe(true);
    expect(trackOnboardingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'help_page_visited',
        meta: expect.objectContaining({ intent: 'client' }),
      }),
    );
  });

  it('reset desativa supressão (uso em testes)', () => {
    markSupportContacted({ source: 'help_page' });
    expect(shouldSuppressExitIntent()).toBe(true);
    resetConversionFunnelForTest();
    expect(shouldSuppressExitIntent()).toBe(false);
  });

  it('source aceita valores diferentes para distinguir origem', () => {
    markSupportContacted({ source: 'help_page', phase: 'help_page' });
    expect(trackOnboardingEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ source: 'help_page' }),
      }),
    );
  });
});
