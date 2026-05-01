/**
 * Garante o contrato SEO do parâmetro ?cep= no /buscar:
 *  1. Quando há ?cep= válido, ele substitui ?cidade= no canonical (mais preciso).
 *  2. Quando ?cep= é inválido (formato errado), a página vai para noindex.
 *  3. CEPs notoriamente inválidos (00000000 / 99999999) também caem em noindex.
 */
import { describe, it, expect } from 'vitest';
import { normalizeCep, formatCep } from '@/lib/cepLookup';

const SITE = 'https://precisodeum.com.br';

/** Replica a lógica de canonical da SearchPage para teste isolado. */
function buildCanonical(input: {
  query?: string;
  category?: string;
  city?: string;
  cep?: string;
  sortBy?: string;
}) {
  const params = new URLSearchParams();
  if (input.query) params.set('q', input.query);
  if (input.category) params.set('categoria', input.category);
  const cepNorm = input.cep ? normalizeCep(input.cep) : null;
  if (cepNorm) {
    params.set('cep', formatCep(cepNorm));
  } else if (input.city) {
    params.set('cidade', input.city);
  }
  if (input.sortBy && input.sortBy !== 'relevance') params.set('ordem', input.sortBy);
  const qs = params.toString();
  return `${SITE}/buscar${qs ? `?${qs}` : ''}`;
}

function shouldNoindex(input: {
  query?: string;
  category?: string;
  city?: string;
  cep?: string;
  page?: number;
  availability?: string;
}) {
  const cepNorm = input.cep ? normalizeCep(input.cep) : null;
  const cepInvalid = !!input.cep && !cepNorm;
  return (
    (!input.query && !input.category && !input.city && !cepNorm) ||
    (input.page ?? 1) > 1 ||
    (input.availability ?? 'any') !== 'any' ||
    cepInvalid
  );
}

describe('SearchPage SEO — ?cep=', () => {
  it('CEP válido substitui cidade no canonical', () => {
    const url = buildCanonical({ category: 'eletricista', city: 'Curitiba', cep: '80000-000' });
    expect(url).toBe(`${SITE}/buscar?categoria=eletricista&cep=80000-000`);
    expect(url).not.toContain('cidade=');
  });

  it('CEP sem hífen é normalizado e formatado', () => {
    const url = buildCanonical({ category: 'encanador', cep: '01310100' });
    expect(url).toBe(`${SITE}/buscar?categoria=encanador&cep=01310-100`);
  });

  it('CEP inválido cai em noindex', () => {
    expect(shouldNoindex({ cep: '123' })).toBe(true);
    expect(shouldNoindex({ cep: '00000000' })).toBe(true);
    expect(shouldNoindex({ cep: '99999999' })).toBe(true);
  });

  it('CEP válido sozinho é indexável (não cai em noindex)', () => {
    expect(shouldNoindex({ cep: '80000-000' })).toBe(false);
  });

  it('cidade sozinha permanece indexável quando não há CEP', () => {
    const url = buildCanonical({ city: 'Curitiba' });
    expect(url).toBe(`${SITE}/buscar?cidade=Curitiba`);
    expect(shouldNoindex({ city: 'Curitiba' })).toBe(false);
  });

  it('paginação > 1 sempre cai em noindex mesmo com CEP válido', () => {
    expect(shouldNoindex({ cep: '80000-000', page: 2 })).toBe(true);
  });
});
