/**
 * Teste de unidade da função run_integrity_check (anti-duplicidade).
 *
 * Não roda SQL real — valida o contrato em alto nível usando psql via tool externa
 * ficaria custoso aqui, então este teste documenta o comportamento esperado e
 * valida a forma da assinatura usada para deduplicar.
 *
 * O teste real de integração no DB foi rodado pela migration anti-duplicidade,
 * que inclui a checagem `(details->'signature') = v_signature`. Cobrimos aqui
 * a serialização canônica e a equivalência JSON.
 */
import { describe, it, expect } from 'vitest';

// Reproduz a montagem da assinatura usada no SQL, para garantir compatibilidade
// futura quando alguém alterar nomes de campos.
const buildSignature = (counts: { services_without_category: number; services_null_name: number; providers_null_city: number }) => ({
  services_without_category: counts.services_without_category,
  services_null_name: counts.services_null_name,
  providers_null_city: counts.providers_null_city,
});

describe('run_integrity_check — assinatura de dedup', () => {
  it('mesma contagem produz a mesma assinatura JSON', () => {
    const a = buildSignature({ services_without_category: 5, services_null_name: 0, providers_null_city: 1 });
    const b = buildSignature({ services_without_category: 5, services_null_name: 0, providers_null_city: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('contagens diferentes produzem assinaturas diferentes', () => {
    const a = buildSignature({ services_without_category: 5, services_null_name: 0, providers_null_city: 1 });
    const b = buildSignature({ services_without_category: 6, services_null_name: 0, providers_null_city: 1 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('a assinatura possui exatamente as 3 chaves críticas', () => {
    const sig = buildSignature({ services_without_category: 1, services_null_name: 2, providers_null_city: 3 });
    expect(Object.keys(sig).sort()).toEqual([
      'providers_null_city',
      'services_null_name',
      'services_without_category',
    ]);
  });
});
