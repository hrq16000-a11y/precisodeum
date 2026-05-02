/**
 * Regression test: garante que a nomenclatura antiga ("Solicitar Orçamento" /
 * "Orçamento sem compromisso" / "gostaria de um orçamento") não volte ao código
 * de UI. A diretriz é "Falar com o profissional" + "Negociação direta e
 * transparente" para eliminar percepção de leilão de preços.
 *
 * Allowlist:
 *   - src/pages/AdminBackupPage.tsx contém um snippet SQL puramente histórico
 *     dentro de uma string literal de exemplo de migration, sem renderização.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const FORBIDDEN = [
  /Solicitar Or[çc]amento/,
  /Solicite or[çc]amento/i,
  /Solicite seu or[çc]amento/i,
  /solicit\w* or[çc]amento/i,
  /Pedir or[çc]amento/i,
  /Pe[çc]a or[çc]amento/i,
  /Or[çc]amento sem compromisso/i,
  /Or[çc]amento gr[áa]tis/i,
  /Or[çc]amento gratuito/i,
  /gostaria de um or[çc]amento/i,
  /Solicitou or[çc]amento/i,
  /Bot[ãa]o de or[çc]amento/i,
  /Formul[áa]rio de or[çc]amento/i,
];
const ALLOWLIST = new Set([
  // SQL DEFAULT histórico, não-UI:
  'pages/AdminBackupPage.tsx',
  // Linter/regulador que detecta a palavra para bloqueá-la na descrição
  // do serviço (proibição é o objetivo do arquivo):
  'lib/serviceQualityLinter.ts',
  // Comentário de doc que explica a regra:
  'lib/leadContext.ts',
  // Painéis de campanhas publicitárias (sponsor) usam "Verba" agora;
  // mantemos como allowlist explícito caso surja string residual.
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      // Não escanear os próprios testes
      if (name === 'test' || name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('CTA terminology regression', () => {
  const files = walk(ROOT);

  it('nenhum arquivo de UI contém termos proibidos', () => {
    const offenders: { file: string; match: string }[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f).replace(/\\/g, '/');
      if (ALLOWLIST.has(rel)) continue;
      const content = readFileSync(f, 'utf8');
      for (const re of FORBIDDEN) {
        const m = content.match(re);
        if (m) offenders.push({ file: rel, match: m[0] });
      }
    }
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});
