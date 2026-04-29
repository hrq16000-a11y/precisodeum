/**
 * Testes da função compartilhada `recoverProviderId` e `fetchProviderServiceCount`.
 * Cobertura solicitada:
 *  - providerId já presente como hint → retorna sem chamar banco
 *  - userId vazio → null sem crash
 *  - lookup bem-sucedido por user_id
 *  - lookup que falha (erro/empty) → null sem crash
 *  - fetchProviderServiceCount com providerId vazio → 0
 *  - fetchProviderServiceCount com sucesso → count exato
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do client antes de importar o SUT
const maybeSingle = vi.fn();
const eqUserId = vi.fn(() => ({ maybeSingle }));
const selectProviders = vi.fn(() => ({ eq: eqUserId }));

const headSelect = vi.fn();
const eqProvider = vi.fn(() => headSelect());
const selectServices = vi.fn(() => ({ eq: eqProvider }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'providers') return { select: selectProviders };
      if (table === 'services') return { select: selectServices };
      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

import { recoverProviderId, fetchProviderServiceCount } from '@/lib/recoverProviderId';

describe('recoverProviderId', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    eqUserId.mockClear();
    selectProviders.mockClear();
    headSelect.mockReset();
    eqProvider.mockClear();
    selectServices.mockClear();
  });

  it('retorna o hint sem chamar o banco quando ele existe', async () => {
    const result = await recoverProviderId({ userId: 'u1', hint: 'pid-1' });
    expect(result).toBe('pid-1');
    expect(selectProviders).not.toHaveBeenCalled();
  });

  it('retorna null sem crash quando userId é vazio e não há hint', async () => {
    const result = await recoverProviderId({ userId: null, hint: null });
    expect(result).toBeNull();
    expect(selectProviders).not.toHaveBeenCalled();
  });

  it('busca no banco quando o hint está vazio', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { id: 'pid-from-db' }, error: null });
    const result = await recoverProviderId({ userId: 'u1', hint: null });
    expect(result).toBe('pid-from-db');
    expect(selectProviders).toHaveBeenCalledWith('id');
  });

  it('retorna null quando o lookup não acha provider', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await recoverProviderId({ userId: 'u1' });
    expect(result).toBeNull();
  });

  it('retorna null sem crash quando o supabase lança exceção', async () => {
    maybeSingle.mockRejectedValueOnce(new Error('network'));
    const result = await recoverProviderId({ userId: 'u1' });
    expect(result).toBeNull();
  });
});

describe('fetchProviderServiceCount', () => {
  beforeEach(() => {
    headSelect.mockReset();
    eqProvider.mockClear();
    selectServices.mockClear();
  });

  it('retorna 0 quando providerId é vazio', async () => {
    const n = await fetchProviderServiceCount(null);
    expect(n).toBe(0);
    expect(selectServices).not.toHaveBeenCalled();
  });

  it('retorna o count exato quando o banco responde', async () => {
    headSelect.mockResolvedValueOnce({ count: 3, error: null });
    const n = await fetchProviderServiceCount('pid-1');
    expect(n).toBe(3);
  });

  it('retorna 0 sem crash em caso de exceção', async () => {
    headSelect.mockRejectedValueOnce(new Error('boom'));
    const n = await fetchProviderServiceCount('pid-1');
    expect(n).toBe(0);
  });
});
