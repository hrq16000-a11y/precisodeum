/**
 * jsonld-validator-report-output.test.ts
 *
 * Garante que `scripts/validate-json-ld.mjs`:
 *   1. Emite um relatório JSON estruturado em disco com a lista exata de
 *      campos/erros faltantes — consumível pelo CI como artefato.
 *   2. Em payloads incompletos, agrupa erros por @type e por arquivo.
 *   3. Sai com código 1 e imprime no stderr quando há erros.
 *
 * Roda o validador em diretórios temporários isolados (não polui src/).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(__dirname, '../../scripts/validate-json-ld.mjs');

function runValidator(workspaceDir: string, reportPath: string) {
  const result = spawnSync('node', [SCRIPT], {
    cwd: workspaceDir,
    env: {
      ...process.env,
      JSONLD_REPORT_PATH: reportPath,
      JSONLD_SRC_DIR: path.join(workspaceDir, 'src'),
    },
    encoding: 'utf-8',
  });
  return result;
}

describe('validate-json-ld.mjs — relatório estruturado', () => {
  let workspace: string;
  const reportPath = path.join(tmpdir(), `jsonld-report-${Date.now()}.json`);

  beforeAll(() => {
    workspace = mkdtempSync(path.join(tmpdir(), 'jsonld-validator-'));
    mkdirSync(path.join(workspace, 'src', 'pages'), { recursive: true });
    // Fixture com BreadcrumbList SEM itemListElement (erro esperado)
    writeFileSync(
      path.join(workspace, 'src', 'pages', 'BadBreadcrumb.tsx'),
      `
        export const data = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          // missing itemListElement on purpose
        };
      `,
    );
    // Fixture com FAQPage sem mainEntity
    writeFileSync(
      path.join(workspace, 'src', 'pages', 'BadFaq.tsx'),
      `
        export const faq = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
        };
      `,
    );
    // Fixture válido (não deve gerar erro)
    writeFileSync(
      path.join(workspace, 'src', 'pages', 'GoodPerson.tsx'),
      `
        export const person = {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: 'João Silva',
        };
      `,
    );
  });

  afterAll(() => {
    try { rmSync(workspace, { recursive: true, force: true }); } catch {}
    try { rmSync(reportPath, { force: true }); } catch {}
  });

  it('produz relatório JSON em disco com erros agrupados por @type e arquivo', () => {
    const result = runValidator(workspace, reportPath);
    // Exit 1 quando há erros
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/JSON-LD inválido/);
    expect(result.stderr).toMatch(/BreadcrumbList/);
    expect(result.stderr).toMatch(/FAQPage/);

    expect(existsSync(reportPath), 'relatório não foi escrito').toBe(true);
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    expect(report.ok).toBe(false);
    expect(report.errorCount).toBeGreaterThanOrEqual(2);
    expect(report.errorsByType.BreadcrumbList).toBeGreaterThanOrEqual(1);
    expect(report.errorsByType.FAQPage).toBeGreaterThanOrEqual(1);
    expect(typeof report.errorsByFile).toBe('object');
    expect(Array.isArray(report.errors)).toBe(true);
    expect(typeof report.generatedAt).toBe('string');
    expect(report.totalBlocks).toBeGreaterThanOrEqual(2);
  });

  it('relatório lista campos faltantes específicos por bloco', () => {
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    const errs = report.errors as string[];
    expect(errs.some((e) => /BreadcrumbList sem campo obrigatório "itemListElement"/.test(e))).toBe(true);
    expect(errs.some((e) => /FAQPage sem campo obrigatório "mainEntity"/.test(e))).toBe(true);
  });
});
