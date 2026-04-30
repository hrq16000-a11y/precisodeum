/**
 * jsonld-validator-failure-cases.test.ts
 *
 * Exercita o validador estático `scripts/validate-json-ld.mjs` contra payloads
 * propositalmente incompletos, garantindo que ele detecta:
 *   - BreadcrumbList sem itemListElement
 *   - ListItem sem position
 *   - FAQPage sem acceptedAnswer
 *   - Question sem name
 *   - AggregateRating sem reviewCount/ratingCount
 *   - PostalAddress sem addressLocality
 *
 * Rodamos o script via `child_process` em arquivos temporários — assim o
 * mesmo binário usado no CI é exercitado, sem reimplementar a lógica.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const VALIDATOR = path.resolve(PROJECT_ROOT, 'scripts/validate-json-ld.mjs');

/**
 * Roda o validador num diretório isolado contendo apenas o arquivo de fixture
 * fornecido. Retorna { ok, stderr } sem lançar.
 */
function runValidatorOn(fixtureContent: string): { ok: boolean; stderr: string } {
  const tmp = mkdtempSync(path.join(tmpdir(), 'jsonld-fixture-'));
  try {
    // O validador só varre `src/`, então plantamos lá dentro.
    const srcDir = path.join(tmp, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(path.join(srcDir, 'fixture.tsx'), fixtureContent, 'utf8');
    // Copiamos o validador para que ele resolva ROOT/SRC_DIR localmente.
    cpSync(VALIDATOR, path.join(tmp, 'validate.mjs'));
    // Mas o validador deriva ROOT de import.meta.url e usa `${ROOT}/src` —
    // executamos a partir de `tmp/scripts/...` para que o ROOT bata.
    const scriptsDir = path.join(tmp, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    cpSync(VALIDATOR, path.join(scriptsDir, 'validate.mjs'));

    try {
      execFileSync('node', [path.join(scriptsDir, 'validate.mjs')], {
        cwd: tmp,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { ok: true, stderr: '' };
    } catch (e: any) {
      return { ok: false, stderr: String(e.stderr || e.message || '') };
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe('JSON-LD validator — payloads incompletos falham conforme esperado', () => {
  it('aceita BreadcrumbList completo', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://x.com/' },
        ],
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok, r.stderr).toBe(true);
  });

  it('rejeita BreadcrumbList sem itemListElement', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/itemListElement/);
  });

  it('rejeita ListItem sem position', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', name: 'X', item: 'https://x.com/' },
        ],
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/position/);
  });

  it('rejeita FAQPage sem Question/acceptedAnswer', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [],
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/Question|acceptedAnswer/);
  });

  it('rejeita Question sem name', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Question',
        acceptedAnswer: { '@type': 'Answer', text: 'ok' },
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/Question.*name|name/);
  });

  it('rejeita AggregateRating sem reviewCount nem ratingCount', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'AggregateRating',
        ratingValue: 4.7,
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/reviewCount|ratingCount/);
  });

  it('rejeita PostalAddress sem addressLocality', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'PostalAddress',
        addressCountry: 'BR',
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/addressLocality/);
  });

  it('aceita LocalBusiness com name (validador não exige campos opcionais)', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Empresa X',
        url: 'https://x.com/',
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok, r.stderr).toBe(true);
  });

  it('rejeita Person sem name', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        jobTitle: 'Eletricista',
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok).toBe(false);
    expect(r.stderr).toMatch(/Person.*name|name/);
  });

  it('aceita Place com address mesmo sem name (uso interno como jobLocation)', () => {
    const fixture = `
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Place',
        address: { '@type': 'PostalAddress', addressLocality: 'São Paulo' },
      };
    `;
    const r = runValidatorOn(fixture);
    expect(r.ok, r.stderr).toBe(true);
  });
});
