/**
 * S2 hardening · agencies: anon NUNCA pode ler cnpj, legal_name, email ou whatsapp.
 *
 * Validamos por dois caminhos:
 *  1. Contrato de UI: AgencyPublicPage não pode usar `.select('*')` nem ler
 *     colunas sensíveis (lista explícita obrigatória).
 *  2. Hint de migration: existe REVOKE SELECT ON public.agencies FROM anon
 *     + GRANT SELECT (cols seguras) ON public.agencies TO anon em algum
 *     arquivo recente de migration.
 *
 * O enforcement real é Postgres column grants (permission denied for column).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('S2 · agencies anon column protection', () => {
  const pagePath = path.join(ROOT, 'src/pages/AgencyPublicPage.tsx');
  const pageSrc = fs.readFileSync(pagePath, 'utf8');

  it('AgencyPublicPage não usa .select("*") em agencies', () => {
    // Captura qualquer .from('agencies').select('*'…)
    const wildcard = /\.from\(['"]agencies['"]\)[\s\S]{0,120}\.select\(\s*['"]\*['"]/;
    expect(wildcard.test(pageSrc)).toBe(false);
  });

  it('AgencyPublicPage não lê colunas sensíveis no JSX (cnpj/legal_name/email/whatsapp)', () => {
    // Garante que a UI pública não exibe nenhum dado bloqueado para anon.
    for (const col of ['agency.cnpj', 'agency.legal_name', 'agency.email', 'agency.whatsapp']) {
      expect(pageSrc.includes(col)).toBe(false);
    }
  });

  it('existe migration recente revogando SELECT de anon em agencies', () => {
    const dir = path.join(ROOT, 'supabase/migrations');
    if (!fs.existsSync(dir)) return; // ambiente sem migrations no checkout — não falha CI
    const files = fs.readdirSync(dir).filter((f) => /\.sql$/.test(f));
    const matched = files.some((f) => {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      return (
        /REVOKE\s+SELECT\s+ON\s+public\.agencies\s+FROM\s+anon/i.test(sql) &&
        /GRANT\s+SELECT\s*\(/i.test(sql) &&
        /\bON\s+public\.agencies\s+TO\s+anon/i.test(sql)
      );
    });
    expect(matched).toBe(true);
  });
});
