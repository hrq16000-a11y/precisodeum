/**
 * Testa o helper `redactAuditRows` — garante que qualquer chave sensível
 * inserida acidentalmente pelo backend é removida antes de chegar à UI.
 */
import { describe, it, expect } from 'vitest';
import { redactAuditRows, AUDIT_SAFE_FIELDS, SENSITIVE_KEYS } from '../AdminSponsorDocsAuditPage';

describe('redactAuditRows — proteção contra vazamento na trilha de auditoria', () => {
  it('mantém apenas os 6 campos whitelisted', () => {
    const [row] = redactAuditRows([{
      id: 'a', lead_id: 'b', action: 'attach_docs', outcome: 'success',
      fields_present: ['cnpj_document_url'], created_at: '2026-01-01T00:00:00Z',
      // extras sujeitos a vazamento se o backend mudar:
      actor_ip: '192.168.0.1', actor_user_agent: 'curl/8',
      metadata: { file_name: 'sensitive.pdf' },
      payload: 'top-secret', cnpj: '00.000.000/0001-91', email: 'x@y.com',
    }]);
    for (const key of AUDIT_SAFE_FIELDS) expect(row).toHaveProperty(key);
    for (const banned of SENSITIVE_KEYS) expect(row).not.toHaveProperty(banned);
  });

  it('sobrevive a linhas vazias/malformadas sem lançar', () => {
    expect(() => redactAuditRows([null, undefined, {}] as any)).not.toThrow();
    const out = redactAuditRows([null, undefined, {}] as any);
    expect(out).toHaveLength(3);
    for (const r of out) {
      for (const banned of SENSITIVE_KEYS) expect(r).not.toHaveProperty(banned);
    }
  });

  it('não expõe SENSITIVE_KEYS mesmo quando fields_present contém nomes sensíveis', () => {
    // fields_present é apenas metadata textual (whitelist) — ok expor,
    // mas nenhum outro campo sensível pode aparecer no objeto raiz.
    const [row] = redactAuditRows([{
      id: '1', lead_id: '2', action: 'attach_docs', outcome: 'success',
      fields_present: ['cnpj_document_url', 'banner_url'],
      created_at: 'now',
    }]);
    expect(row.fields_present).toContain('cnpj_document_url');
    expect((row as any).cnpj_document_url).toBeUndefined();
    expect((row as any).banner_url).toBeUndefined();
  });
});
