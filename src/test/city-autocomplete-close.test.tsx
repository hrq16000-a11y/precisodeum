import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CityAutocomplete from '@/components/CityAutocomplete';

// Mock supabase to return one city
vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: () => builder,
    ilike: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({
      data: [{ id: 'c1', name: 'Curitiba', state: 'PR', state_uf: 'PR' }],
      error: null,
    }),
    then: (fn: any) => Promise.resolve({
      data: [{ id: 'c1', name: 'Curitiba', state: 'PR', state_uf: 'PR' }],
      error: null,
    }).then(fn),
  };
  return {
    supabase: {
      from: () => builder,
    },
  };
});

describe('CityAutocomplete — close & sync behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('fires onClose when popover closes after selection and syncs city/state', async () => {
    vi.useRealTimers();
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <CityAutocomplete
        value={{ city: '', state: '' }}
        onChange={onChange}
        onClose={onClose}
      />
    );

    // Open the combobox
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Type a query
    const input = await screen.findByPlaceholderText(/digite o nome da cidade/i);
    fireEvent.change(input, { target: { value: 'Cur' } });

    // Wait for the option, then select
    const option = await screen.findByText('Curitiba', {}, { timeout: 3000 });
    fireEvent.click(option);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ city: 'Curitiba', state: 'PR' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('fires onClose when popover closes via Escape (no selection)', async () => {
    vi.useRealTimers();
    const onClose = vi.fn();
    render(
      <CityAutocomplete
        value={{ city: 'Curitiba', state: 'PR' }}
        onChange={() => {}}
        onClose={onClose}
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Close via Escape on the popover content
    fireEvent.keyDown(document.activeElement || trigger, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
