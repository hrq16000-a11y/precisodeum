/**
 * E2E garantia: "Meus Serviços" nunca renderiza texto fora da seleção.
 *
 * Simula payloads legados que poderiam vazar para a UI:
 *   - service_area com prefixo "Toda " ainda persistido no banco
 *   - service_area com cidade divergente do provider
 *   - service_area null + provider sem cidade (estado seguro)
 *   - service_area com texto livre não catalogado
 *
 * Em todos os casos, o rótulo final precisa vir de formatServiceArea
 * e nunca conter "Toda Curitiba" cru.
 */
import { describe, it, expect } from 'vitest';
import {
  formatServiceArea,
  isCatalogedCity,
  SAFE_EMPTY_STATE,
} from '@/lib/serviceAreaFormat';

const CATALOG = [
  { value: 'Curitiba', label: 'Curitiba - PR' },
  { value: 'São Paulo', label: 'São Paulo - SP' },
];

interface LegacyServiceRow {
  service_area: string | null;
  service_radius: string | null;
  provider_city: string | null;
}

const legacyRows: LegacyServiceRow[] = [
  // Caso 1 — bug reportado pelo usuário
  { service_area: 'Toda Curitiba', service_radius: null, provider_city: 'Curitiba' },
  // Caso 2 — radius city + provider.city (preferido)
  { service_area: 'Toda Curitiba', service_radius: 'city', provider_city: 'Curitiba' },
  // Caso 3 — provider sem cidade + dado legado sujo
  { service_area: 'Toda Curitiba', service_radius: null, provider_city: null },
  // Caso 4 — divergência de cidade entre provider e service_area
  { service_area: 'Toda São Paulo', service_radius: null, provider_city: 'Curitiba' },
  // Caso 5 — completamente vazio
  { service_area: null, service_radius: null, provider_city: null },
];

describe('E2E "Meus Serviços" — rótulos sempre vêm do helper', () => {
  it('NENHUM payload legado produz "Toda <Cidade>" cru na UI', () => {
    legacyRows.forEach((row, idx) => {
      const label = formatServiceArea(row.service_area, row.service_radius, row.provider_city);
      expect(label, `linha ${idx}: "${label}"`).not.toMatch(/^toda\s+\w/i);
      expect(label, `linha ${idx}: "${label}"`).not.toMatch(/^em\s+toda\s+/i);
    });
  });

  it('estado seguro quando provider.city está ausente E não há texto válido', () => {
    const label = formatServiceArea(null, null, null);
    expect(label).toBe(SAFE_EMPTY_STATE);
    expect(label).toBe('Atualize sua cidade');
  });

  it('com radius city + provider.city, sempre usa rótulo controlado', () => {
    const label = formatServiceArea('Toda Curitiba', 'city', 'Curitiba');
    expect(label).toBe('Toda a cidade — Curitiba');
  });

  it('rejeita cidades não catalogadas (digitação livre no wizard)', () => {
    expect(isCatalogedCity('Cidade Inventada SP', CATALOG)).toBe(false);
    expect(isCatalogedCity('Curitiba Norte', CATALOG)).toBe(false);
    expect(isCatalogedCity('Curitiba', CATALOG)).toBe(true);
  });

  it('todos os 5 cenários legados produzem rótulo seguro e renderizável', () => {
    const labels = legacyRows.map((r) =>
      formatServiceArea(r.service_area, r.service_radius, r.provider_city),
    );
    // Nenhum vazio, nenhum começa com "Toda " seguido de cidade crua
    labels.forEach((l) => {
      expect(typeof l).toBe('string');
      expect(l.length).toBeGreaterThan(0);
      // Permitido: "Toda a cidade — Curitiba" (rótulo controlado), proibido: "Toda Curitiba"
      if (/^toda /i.test(l)) {
        expect(l).toMatch(/^toda a cidade/i);
      }
    });
  });
});
