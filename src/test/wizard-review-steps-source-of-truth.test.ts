/**
 * wizard-review-steps-source-of-truth.test.ts
 *
 * Trava REVIEW_PHASE_ORDER / REVIEW_TOTAL_STEPS como FONTE ÚNICA.
 *
 * Regras anti-regressão:
 *   1) `REVIEW_PHASE_ORDER` re-exportado pelo reducer === o do módulo canônico.
 *   2) `REVIEW_TOTAL_STEPS === 19` (constante explícita).
 *   3) `REVIEW_PHASE_ORDER` termina em 'done' (sentinela).
 *   4) `DashboardAssistantPage` consome `REVIEW_STEP_CATALOG` (não redefine literal).
 *   5) Test guard global: NENHUM arquivo do projeto importa as constantes
 *      `REVIEW_PHASE_ORDER`/`REVIEW_TOTAL_STEPS`/`isReviewPhaseRenderable`/
 *      `nextRenderableReviewPhase`/`prevRenderableReviewPhase`/
 *      `isReviewMilestonePhase` de qualquer lugar que NÃO seja
 *      `./wizardReviewSteps` (módulo canônico) ou `./wizardReducer`
 *      (que apenas re-exporta para compat). Isso impede que outro arquivo
 *      passe a redefinir/copiar a régua e dessincronize HUD vs Dashboard.
 */
import { describe, it, expect } from 'vitest';
import * as canonical from '@/components/onboarding/wizard/wizardReviewSteps';
import * as reducer from '@/components/onboarding/wizard/wizardReducer';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

describe('REVIEW_PHASE_ORDER — fonte única', () => {
  it('reducer re-exporta exatamente as constantes canônicas', () => {
    expect(reducer.REVIEW_PHASE_ORDER).toBe(canonical.REVIEW_PHASE_ORDER);
    expect(reducer.REVIEW_TOTAL_STEPS).toBe(canonical.REVIEW_TOTAL_STEPS);
  });

  it('REVIEW_TOTAL_STEPS é a constante canônica X/19 compartilhada', () => {
    expect(canonical.REVIEW_TOTAL_STEPS).toBe(19);
  });

  it("REVIEW_PHASE_ORDER termina em 'done' como sentinela", () => {
    const last = canonical.REVIEW_PHASE_ORDER[canonical.REVIEW_PHASE_ORDER.length - 1];
    expect(last).toBe('done');
  });

  it('DashboardAssistantPage não redefine PHASE_CATALOG localmente', () => {
    const filePath = resolve(__dirname, '../pages/DashboardAssistantPage.tsx');
    const src = readFileSync(filePath, 'utf-8');
    expect(src).toMatch(/from '@\/components\/onboarding\/wizard\/wizardReviewSteps'/);
    expect(src).toMatch(/REVIEW_STEP_CATALOG/);
    const literalEntries = src.match(/\{\s*phase:\s*'[a-z_]+'/g) ?? [];
    expect(literalEntries.length).toBeLessThan(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test guard global: REVIEW_* vêm SEMPRE da fonte única
// ─────────────────────────────────────────────────────────────────────────────

const PROTECTED_NAMES = [
  'REVIEW_PHASE_ORDER',
  'REVIEW_TOTAL_STEPS',
  'isReviewPhaseRenderable',
  'nextRenderableReviewPhase',
  'prevRenderableReviewPhase',
  'isReviewMilestonePhase',
];

// Caminhos absolutos que PODEM exportar/importar essas constantes:
//   - o próprio módulo canônico (define);
//   - o wizardReducer (re-exporta para compat de imports antigos).
const CANONICAL_FILE = resolve(
  __dirname,
  '../components/onboarding/wizard/wizardReviewSteps.ts',
);
const RE_EXPORTER_FILE = resolve(
  __dirname,
  '../components/onboarding/wizard/wizardReducer.ts',
);
// O próprio test-file pode mencionar os nomes em strings — exclui-se.
const SELF_FILE = resolve(__dirname, 'wizard-review-steps-source-of-truth.test.ts');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

describe('Test guard: imports de REVIEW_* vêm SEMPRE de wizardReviewSteps/wizardReducer', () => {
  const srcRoot = resolve(__dirname, '..');
  const offenders: Array<{ file: string; name: string; line: string }> = [];

  for (const file of walk(srcRoot)) {
    if (file === CANONICAL_FILE || file === RE_EXPORTER_FILE || file === SELF_FILE) continue;
    const content = readFileSync(file, 'utf-8');
    if (!PROTECTED_NAMES.some((n) => content.includes(n))) continue;

    // Procura blocos de `import { ... } from '...';` que tragam algum nome
    // protegido. Aceita SOMENTE quando o `from` aponta para o módulo
    // canônico (`wizardReviewSteps`) ou o re-exporter (`wizardReducer`).
    const importRe = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(content)) !== null) {
      const named = m[1];
      const from = m[2];
      const matchedName = PROTECTED_NAMES.find((n) =>
        new RegExp(`(^|\\s|,)${n}(\\s|,|$)`).test(named),
      );
      if (!matchedName) continue;
      const ok = /(^|\/)wizardReviewSteps$/.test(from) || /(^|\/)wizardReducer$/.test(from);
      if (!ok) {
        offenders.push({
          file: relative(srcRoot, file),
          name: matchedName,
          line: m[0].slice(0, 200),
        });
      }
    }
  }

  it('nenhum arquivo importa REVIEW_* fora da fonte única', () => {
    expect(
      offenders,
      `Imports proibidos detectados:\n${offenders
        .map((o) => ` - ${o.file}: ${o.name} via "${o.line}"`)
        .join('\n')}`,
    ).toEqual([]);
  });
});
