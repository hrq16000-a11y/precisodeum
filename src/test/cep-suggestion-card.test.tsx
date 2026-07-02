/**
 * Testes do CepSuggestionCard — estados loading / success / not_found / error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CepSuggestionCard from '@/components/onboarding/wizard/phases/bet/CepSuggestionCard';

const lookupMock = vi.fn();
vi.mock('@/lib/cepReverseLookup', () => ({
  lookupCepFromCity: (...args: any[]) => lookupMock(...args),
}));

describe('CepSuggestionCard', () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it('renders nothing when inputs are insufficient', () => {
    const { container } = render(
      <CepSuggestionCard
        city="A"
        state="P"
        neighborhood=""
        onApply={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading then success with apply CTA', async () => {
    lookupMock.mockResolvedValueOnce({
      ok: true,
      match: { cep: '80010-000', city: 'Curitiba', state: 'PR', neighborhood: 'Centro', street: 'Rua XV' },
      candidates: [],
    });
    const onApply = vi.fn();
    render(
      <CepSuggestionCard
        city="Curitiba"
        state="PR"
        neighborhood="Centro"
        debounceMs={0}
        onApply={onApply}
      />,
    );
    expect(await screen.findByTestId('cep-suggestion-success')).toBeInTheDocument();
    expect(screen.getByText(/CEP do bairro: 80010-000/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cep-suggestion-apply'));
    expect(onApply).toHaveBeenCalledWith('80010-000', expect.objectContaining({ neighborhood: 'Centro' }));
  });

  it('shows not_found state', async () => {
    lookupMock.mockResolvedValueOnce({ ok: false, reason: 'not_found' });
    render(
      <CepSuggestionCard
        city="Curitiba"
        state="PR"
        neighborhood="Inexistente"
        debounceMs={0}
        onApply={() => {}}
      />,
    );
    expect(await screen.findByTestId('cep-suggestion-not-found')).toBeInTheDocument();
  });

  it('shows error state with retry, then succeeds on retry', async () => {
    lookupMock.mockResolvedValueOnce({ ok: false, reason: 'network' });
    render(
      <CepSuggestionCard
        city="Curitiba"
        state="PR"
        neighborhood="Centro"
        debounceMs={0}
        onApply={() => {}}
      />,
    );
    expect(await screen.findByTestId('cep-suggestion-error')).toBeInTheDocument();
    lookupMock.mockResolvedValueOnce({
      ok: true,
      match: { cep: '80010-000', city: 'Curitiba', state: 'PR', neighborhood: 'Centro', street: 'X' },
      candidates: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    await waitFor(() => {
      expect(screen.getByTestId('cep-suggestion-success')).toBeInTheDocument();
    });
  });

  it('shows applied feedback when currentValue matches', async () => {
    lookupMock.mockResolvedValueOnce({
      ok: true,
      match: { cep: '80010-000', city: 'Curitiba', state: 'PR', neighborhood: 'Centro', street: 'X' },
      candidates: [],
    });
    render(
      <CepSuggestionCard
        city="Curitiba"
        state="PR"
        neighborhood="Centro"
        currentValue="80010000"
        debounceMs={0}
        onApply={() => {}}
      />,
    );
    expect(await screen.findByTestId('cep-suggestion-applied')).toBeInTheDocument();
  });
});
