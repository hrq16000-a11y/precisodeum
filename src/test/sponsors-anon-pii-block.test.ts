/**
 * A1 hardening · sponsors: anon NUNCA pode ler cnpj, email, whatsapp ou phone.
 *
 * 1. Contrato de UI: SponsorPublicPage e useSponsors não podem usar `.select('*')`
 *    em sponsors nem renderizar colunas sensíveis para visitantes anônimos.
 * 2. Hint de migration: existe REVOKE SELECT ON public.sponsors FROM anon
 *    + GRANT SELECT (cols seguras) ON public.sponsors TO anon.
 *
 * Enforcement real é feito por column grants no Postgres
 * (permission denied for column).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('A1 · sponsors anon column protection', () => {
  const pagePath = path.join(ROOT, 'src/pages/SponsorPublicPage.tsx');
  const hookPath = path.join(ROOT, 'src/hooks/useSponsors.ts');
  const pageSrc = fs.readFileSync(pagePath, 'utf8');
  const hookSrc = fs.readFileSync(hookPath, 'utf8');

  it('SponsorPublicPage não usa .select("*") em sponsors', () => {
    const wildcard = /\.from\(['"]sponsors['"]\)[\s\S]{0,160}\.select\(\s*['"]\*['"]/;
    expect(wildcard.test(pageSrc)).toBe(false);
  });

  it('useSponsors não usa .select("*") em sponsors', () => {
    const wildcard = /\.from\(['"]sponsors['"]\)[\s\S]{0,160}\.select\(\s*['"]\*['"]/;
    expect(wildcard.test(hookSrc)).toBe(false);
  });

  it('SponsorPublicPage não exibe colunas sensíveis (email/whatsapp/phone/cnpj)', () => {
    for (const col of ['sponsor.email', 'sponsor.whatsapp', 'sponsor.phone', 'sponsor.cnpj']) {
      expect(pageSrc.includes(col)).toBe(false);
    }
  });

  it('existe migration recente revogando SELECT de anon em sponsors', () => {
    const dir = path.join(ROOT, 'supabase/migrations');
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter((f) => /\.sql$/.test(f));
    const matched = files.some((f) => {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      return (
        /REVOKE\s+SELECT\s+ON\s+public\.sponsors\s+FROM\s+anon/i.test(sql) &&
        /GRANT\s+SELECT\s*\(/i.test(sql) &&
        /\bON\s+public\.sponsors\s+TO\s+anon/i.test(sql) &&
        /DROP\s+POLICY[\s\S]{0,80}Sponsors viewable by everyone/i.test(sql)
      );
    });
    expect(matched).toBe(true);
  });
});
