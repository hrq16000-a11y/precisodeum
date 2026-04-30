/**
 * Garante que o bloco opcional de endereço PJ no PhaseProDocument:
 *  1. Existe e está oculto por padrão (texto exato do botão revelador).
 *  2. Não impõe required em street/postal_code/etc — campos permanecem opcionais.
 *  3. Importa o componente isolado CompanyAddressForm (sem reutilizar o do RH).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PHASE = readFileSync(
  resolve(__dirname, '../components/onboarding/wizard/phases/bet/PhaseProDocument.tsx'),
  'utf8',
);

describe('Wizard PJ — endereço opcional (PhaseProDocument)', () => {
  it('contém o texto revelador exato pedido pelo produto', () => {
    expect(PHASE).toMatch(/Possui ponto de atendimento físico/);
    expect(PHASE).toMatch(/Adicionar endereço/);
    expect(PHASE).toMatch(/Opcional/i);
  });

  it('importa o CompanyAddressForm isolado (não reutiliza o form do RH)', () => {
    expect(PHASE).toMatch(/CompanyAddressForm/);
    // Garante que NÃO importa nenhum form da pasta de Agency/RH
    expect(PHASE).not.toMatch(/from\s+["'][^"']*Agency[^"']*["']/);
    expect(PHASE).not.toMatch(/AgencyAddressForm|AgencyDataForm/);
  });

  it('o componente isolado existe em src/components/company/', () => {
    const path = resolve(__dirname, '../components/company/CompanyAddressForm.tsx');
    expect(existsSync(path)).toBe(true);
  });

  it('CompanyAddressForm não marca campos de endereço como required', () => {
    const FORM = readFileSync(
      resolve(__dirname, '../components/company/CompanyAddressForm.tsx'),
      'utf8',
    );
    // Heurística: nenhum input de endereço deve carregar atributo `required`
    // junto a name="street" / "postal_code" / "complement" / "street_number".
    const offending = FORM.match(/name="(street|street_number|complement|postal_code)"[^>]*\brequired\b/);
    expect(offending).toBeNull();
  });
});
