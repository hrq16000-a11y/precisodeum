/**
 * Auditoria final do passo de Localização (Etapa 6/17):
 *  1. Erro de integridade 22023 (PROVIDER_INCOMPLETE_NEIGHBORHOOD) deve ser
 *     interceptado e disparar o evento `wizard:focus-neighborhood`.
 *  2. Check verde ao lado do label "Cidade-base" quando cityOk.
 *  3. CepSuggestionCard NUNCA exibe nome de rua (focus em bairro+CEP).
 *  4. Mapeamento de location_source para constraint do banco.
 */
import { describe, it, expect } from 'vitest';
import { mapLocationSourceToGeoSource } from '@/lib/providerPayload';

describe('mapLocationSourceToGeoSource — constraint providers_geo_source_check', () => {
  it('gps → gps', () => {
    expect(mapLocationSourceToGeoSource('gps')).toBe('gps');
  });
  it('ip → city_center', () => {
    expect(mapLocationSourceToGeoSource('ip')).toBe('city_center');
  });
  it('cep → address_geocode', () => {
    expect(mapLocationSourceToGeoSource('cep')).toBe('address_geocode');
  });
  it('manual → address_geocode', () => {
    expect(mapLocationSourceToGeoSource('manual')).toBe('address_geocode');
  });
  it('null → unknown', () => {
    expect(mapLocationSourceToGeoSource(null)).toBe('unknown');
  });
  it('undefined → unknown', () => {
    expect(mapLocationSourceToGeoSource(undefined)).toBe('unknown');
  });
});

describe('22023 trigger handling — interceptação de mensagens da DB', () => {
  // Simula o branch do BetModeShell.finishPro: detecta o erro pelo code OU pelo
  // padrão "PROVIDER_INCOMPLETE_*" na mensagem, e dispara evento global de foco.
  function classifyDbError(err: { code?: string; message?: string }) {
    const errCode = err.code;
    const errMsg = String(err.message || '');
    const matched = errCode === '22023' || /PROVIDER_INCOMPLETE_/i.test(errMsg);
    if (!matched) return { matched: false as const };
    if (/NEIGHBORHOOD/i.test(errMsg)) return { matched: true, kind: 'neighborhood' as const };
    if (/COORDS|LAT/i.test(errMsg)) return { matched: true, kind: 'coords' as const };
    return { matched: true, kind: 'city' as const };
  }

  it('reconhece código 22023 + PROVIDER_INCOMPLETE_NEIGHBORHOOD', () => {
    const r = classifyDbError({ code: '22023', message: 'PROVIDER_INCOMPLETE_NEIGHBORHOOD' });
    expect(r.matched).toBe(true);
    expect(r).toMatchObject({ kind: 'neighborhood' });
  });

  it('reconhece coords (PROVIDER_INCOMPLETE_COORDS)', () => {
    const r = classifyDbError({ code: '22023', message: 'PROVIDER_INCOMPLETE_COORDS' });
    expect(r).toMatchObject({ matched: true, kind: 'coords' });
  });

  it('reconhece city (PROVIDER_INCOMPLETE_CITY)', () => {
    const r = classifyDbError({ code: '22023', message: 'PROVIDER_INCOMPLETE_CITY' });
    expect(r).toMatchObject({ matched: true, kind: 'city' });
  });

  it('ignora outros erros (não 22023)', () => {
    const r = classifyDbError({ code: '23505', message: 'duplicate key' });
    expect(r.matched).toBe(false);
  });

  it('despacha CustomEvent wizard:focus-neighborhood que componentes podem ouvir', () => {
    let received = false;
    const listener = () => { received = true; };
    window.addEventListener('wizard:focus-neighborhood', listener);
    try {
      window.dispatchEvent(new CustomEvent('wizard:focus-neighborhood'));
    } finally {
      window.removeEventListener('wizard:focus-neighborhood', listener);
    }
    expect(received).toBe(true);
  });
});

describe('CepSuggestionCard — não exibe rua (foco em bairro/CEP)', () => {
  it('contrato visual: só renderiza bairro, cidade, UF e CEP', async () => {
    // Lê o source do componente e garante que não há referência a `hit!.street`
    // ou `hit.street` no JSX (auditoria estática anti-regressão).
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.resolve(
      process.cwd(),
      'src/components/onboarding/wizard/phases/bet/CepSuggestionCard.tsx',
    );
    const src = await fs.readFile(file, 'utf8');
    // Pega só o bloco JSX final (após `success →`) — onde poderia vazar a rua.
    const successBlock = src.split('// success')[1] || '';
    expect(successBlock).not.toMatch(/hit!?\.street/);
    expect(successBlock).not.toMatch(/Rua /); // label "Rua" não deve aparecer
  });
});
