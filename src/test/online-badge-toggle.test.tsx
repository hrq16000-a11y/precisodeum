import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { OnlineBadge } from '@/components/OnlineBadge';
import { __presenceInternals } from '@/hooks/useOnlinePresence';

const USER = 'user-1';

beforeEach(() => {
  __presenceInternals.reset();
  // Mark realtime as healthy so the badge renders (degraded → returns null).
  __presenceInternals.setHealth('healthy');
});

afterEach(() => {
  cleanup();
});

describe('OnlineBadge — toggles between Online and Offline reactively', () => {
  it('renders the Online badge when presence is active', () => {
    __presenceInternals.applyState({ providers: [{ user_id: USER, online_since: Date.now() }] });
    render(<OnlineBadge userId={USER} showOffline />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('switches to Offline (with lastSeen tooltip) when presence drops — without remount', () => {
    const start = Date.now();
    // First sync: user is online
    __presenceInternals.applyState({ providers: [{ user_id: USER, online_since: start }] }, start);
    const { rerender } = render(<OnlineBadge userId={USER} showOffline />);
    expect(screen.getByText('Online')).toBeInTheDocument();

    // Second sync: user is gone → lastSeen is captured
    act(() => {
      __presenceInternals.applyState({ providers: [] }, start + 60_000);
    });
    rerender(<OnlineBadge userId={USER} showOffline />);
    expect(screen.queryByText('Online')).toBeNull();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    // Tooltip aria-label uses "Visto pela última vez há ..."
    const badge = screen.getByRole('status');
    expect(badge.getAttribute('aria-label') ?? '').toMatch(/Visto pela última vez há/);
  });

  it('hides the Offline badge once it falls outside the offlineVisibleWindowMs', () => {
    const start = Date.now();
    __presenceInternals.applyState({ providers: [{ user_id: USER, online_since: start }] }, start);
    const { rerender } = render(
      <OnlineBadge userId={USER} showOffline offlineVisibleWindowMs={5_000} />,
    );

    // Drop offline 10s ago — beyond the 5s configured window
    act(() => {
      __presenceInternals.applyState({ providers: [] }, start - 10_000);
    });
    rerender(<OnlineBadge userId={USER} showOffline offlineVisibleWindowMs={5_000} />);
    expect(screen.queryByText('Offline')).toBeNull();
    expect(screen.queryByText('Online')).toBeNull();
  });

  it('falls back (renders nothing) when realtime is degraded', () => {
    __presenceInternals.applyState({ providers: [{ user_id: USER, online_since: Date.now() }] });
    __presenceInternals.setHealth('degraded');
    const { container } = render(<OnlineBadge userId={USER} showOffline />);
    expect(container.firstChild).toBeNull();
  });
});
