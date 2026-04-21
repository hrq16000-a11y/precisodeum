/**
 * Stress test for the UI freeze monitor.
 * Simulates a full-viewport blocking overlay on /dashboard and asserts the monitor
 * detects it and triggers a critical-severity report via reportError.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock errorReporter so we can spy on calls without hitting Supabase
vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn().mockResolvedValue(null),
  trackAction: vi.fn(),
}));

// Import AFTER the mock
import { reportError, trackAction } from '@/lib/errorReporter';

const installBlockingOverlay = () => {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-radix-dialog-overlay', '');
  overlay.setAttribute('data-component', 'TestBlockingOverlay');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.pointerEvents = 'auto';
  overlay.style.visibility = 'visible';
  overlay.style.display = 'block';
  document.body.appendChild(overlay);
  return overlay;
};

describe('uiFreezeMonitor — stress test', () => {
  let originalElementFromPoint: typeof document.elementFromPoint;
  let originalGetComputedStyle: typeof window.getComputedStyle;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // jsdom does not implement layout — fake the bits the monitor relies on
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    window.history.replaceState({}, '', '/dashboard/servicos');

    originalElementFromPoint = document.elementFromPoint;
    originalGetComputedStyle = window.getComputedStyle;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.elementFromPoint = originalElementFromPoint;
    window.getComputedStyle = originalGetComputedStyle;
    document.body.innerHTML = '';
  });

  it('reports a critical error when a blocking overlay covers the dashboard viewport', async () => {
    const overlay = installBlockingOverlay();

    document.elementFromPoint = vi.fn(() => overlay) as unknown as typeof document.elementFromPoint;
    window.getComputedStyle = ((el: Element) => ({
      pointerEvents: 'auto',
      visibility: 'visible',
      display: 'block',
    })) as unknown as typeof window.getComputedStyle;
    overlay.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 1280, bottom: 800,
      width: 1280, height: 800, toJSON: () => ({}),
    });

    const { initializeUiFreezeMonitor } = await import('@/lib/uiFreezeMonitor');
    initializeUiFreezeMonitor();

    // Tick the 5s interval and let the async inspector resolve
    await vi.advanceTimersByTimeAsync(5100);

    expect(trackAction).toHaveBeenCalledWith('ui_freeze_detected', expect.any(String));
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        componentName: 'DashboardUiFreezeMonitor',
      }),
    );
  });

  it('does NOT report when no blocking overlay is present', async () => {
    document.elementFromPoint = vi.fn(() => document.body) as unknown as typeof document.elementFromPoint;

    const { initializeUiFreezeMonitor } = await import('@/lib/uiFreezeMonitor');
    initializeUiFreezeMonitor();

    await vi.advanceTimersByTimeAsync(5100);

    expect(reportError).not.toHaveBeenCalled();
  });
});
