/**
 * REGRESSÃO DE PALETA — Bet Mode (âmbar → laranja → verde)
 *
 * Garante que nenhuma nova tela do Wizard ou do Dashboard volte a
 * usar cores Tailwind cruas fora da paleta oficial. Qualquer
 * commit que reintroduzir blue/sky/cyan/teal/lime/indigo/violet/
 * purple/fuchsia/pink/rose nas pastas auditadas vai quebrar este teste.
 *
 * Como adicionar uma cor nova ao projeto:
 *   1) Defina o token HSL em src/index.css (--bet-...).
 *   2) Exponha no tailwind.config.ts dentro de `colors.bet.*`.
 *   3) Use bg-bet-*, text-bet-*, ring-bet-*, etc.
 *   NÃO use classes Tailwind cruas em componentes do Wizard/Dashboard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');

const TARGETS = [
  'src/components/onboarding',
  'src/components/dashboard',
  'src/pages/DashboardPage.tsx',
  'src/pages/dashboard',
];

const FORBIDDEN = [
  'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose',
  'blue', 'sky', 'cyan', 'teal', 'lime',
];

const PREFIXES = [
  'from', 'via', 'to',
  'bg', 'text', 'border', 'ring', 'shadow',
  'divide', 'outline', 'fill', 'stroke',
  'caret', 'accent', 'decoration', 'placeholder',
];

const VARIANTS = [
  '',
  'hover:', 'focus:', 'focus-visible:', 'active:',
  'group-hover:', 'peer-hover:', 'disabled:', 'dark:',
];

const exts = new Set(['.ts', '.tsx', '.css']);

function walk(p: string, out: string[] = []): string[] {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) walk(path.join(p, e), out);
  } else if (exts.has(path.extname(p))) {
    out.push(p);
  }
  return out;
}

function buildRegex(): RegExp {
  const variantGroup = VARIANTS.map((v) => v.replace(/:/g, '\\:')).join('|');
  const prefixGroup = PREFIXES.join('|');
  const colorGroup = FORBIDDEN.join('|');
  // ex.: hover:from-blue-500, dark:bg-purple-200, ring-pink-300
  return new RegExp(
    `\\b(?:${variantGroup})(?:${prefixGroup})-(${colorGroup})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`,
    'g',
  );
}

describe('Bet Mode palette regression', () => {
  it('não deve haver cores fora da paleta âmbar/laranja/verde no Wizard/Dashboard', () => {
    const files = TARGETS.flatMap((t) => walk(path.join(ROOT, t)));
    const re = buildRegex();
    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, idx) => {
        // ignora linhas em comentário de uma linha começando com //
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        const matches = line.matchAll(re);
        for (const m of matches) {
          violations.push({
            file: path.relative(ROOT, f),
            line: idx + 1,
            match: m[0],
          });
        }
      });
    }

    if (violations.length > 0) {
      const report = violations
        .slice(0, 30)
        .map((v) => `  ${v.file}:${v.line}  →  ${v.match}`)
        .join('\n');
      throw new Error(
        `Encontradas ${violations.length} ocorrência(s) de cores fora da paleta Bet Mode.\n` +
          `Use tokens semânticos (bg-bet-amber, text-bet-orange-fg, etc.) ou helpers de src/lib/betPalette.ts.\n\n` +
          report +
          (violations.length > 30 ? `\n  ... +${violations.length - 30} mais` : ''),
      );
    }

    expect(violations).toEqual([]);
  });

  it('os tokens bet-* devem existir em src/index.css', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
    const required = [
      '--bet-amber',
      '--bet-amber-hover',
      '--bet-orange',
      '--bet-orange-hover',
      '--bet-green',
      '--bet-green-hover',
      '--bet-error',
      '--bet-disabled-bg',
      '--bet-gradient',
    ];
    for (const token of required) {
      expect(css, `token ${token} ausente em src/index.css`).toContain(token);
    }
  });

  it('o helper src/lib/betPalette.ts deve exportar `bet` com chaves canônicas', async () => {
    const mod = await import('@/lib/betPalette');
    expect(mod.bet).toBeDefined();
    for (const key of ['button', 'input', 'surface', 'text', 'badge', 'state', 'gradient']) {
      expect(mod.bet, `chave ${key} ausente em betPalette`).toHaveProperty(key);
    }
    // estados obrigatórios em button
    for (const v of ['primary', 'secondary', 'ghost', 'destructive']) {
      expect(mod.bet.button).toHaveProperty(v);
    }
    // estados obrigatórios em input
    for (const v of ['base', 'error', 'success']) {
      expect(mod.bet.input).toHaveProperty(v);
    }
  });
});
