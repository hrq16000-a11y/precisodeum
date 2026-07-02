import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GeoFallbackNotice from '@/components/GeoFallbackNotice';

vi.mock('@/components/CityAutocomplete', () => ({
  default: ({ onChange }: any) => (
    <button data-testid="mock-city-pick" onClick={() => onChange({ city: 'São Paulo', state: 'SP' })}>
      Pick
    </button>
  ),
}));

const setCityMock = vi.fn();
vi.mock('@/hooks/useGeoCity', () => ({
  useGeoCity: () => ({ setCity: setCityMock }),
}));

const trackMock = vi.fn();
vi.mock('@/lib/tracking', () => ({
  trackGeoEvent: (...args: any[]) => trackMock(...args),
}));

describe('GeoFallbackNotice', () => {
  beforeEach(() => {
    setCityMock.mockClear();
    trackMock.mockClear();
  });

  it('renders fallback warning with source label and accuracy estimate', () => {
    render(
      <GeoFallbackNotice
        city="Belo Horizonte"
        source="cache"
        lastKnownAt={new Date(Date.now() - 30 * 60_000).toISOString()}
        onRetry={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByTestId('geo-fallback-notice')).toBeInTheDocument();
    expect(screen.getByText(/última localização salva/i)).toBeInTheDocument();
    expect(screen.getByText(/Belo Horizonte/)).toBeInTheDocument();
    expect(screen.getByText(/Precisão estimada:/i)).toBeInTheDocument();
    expect(screen.getByText(/~30 km/)).toBeInTheDocument();
  });

  it('emits geo_fallback_used telemetry on mount', () => {
    render(
      <GeoFallbackNotice
        city="Rio"
        source="ip"
        lastKnownAt={null}
        onRetry={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(trackMock).toHaveBeenCalledWith('geo_fallback_used', expect.objectContaining({ source: 'ip' }));
  });

  it('calls onRetry when "Tentar novamente" is clicked and logs geo_failed', () => {
    const retry = vi.fn();
    render(
      <GeoFallbackNotice city="Rio" source="ip" lastKnownAt={null} onRetry={retry} onDismiss={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(retry).toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith('geo_failed', expect.objectContaining({ action: 'retry' }));
  });

  it('lets user pick city manually and dismisses notice', () => {
    const dismiss = vi.fn();
    render(
      <GeoFallbackNotice city={null} source="none" lastKnownAt={null} onRetry={() => {}} onDismiss={dismiss} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Escolher cidade\/CEP manualmente/i }));
    fireEvent.click(screen.getByTestId('mock-city-pick'));
    expect(setCityMock).toHaveBeenCalledWith('São Paulo', 'SP');
    expect(dismiss).toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith('geo_failed', expect.objectContaining({ action: 'manual_picked' }));
  });
});
