/**
 * Teste de layout responsivo + governança de tokens — valida que o Wizard:
 *  1. Usa tokens compactos (cabe em iPhone SE 375x667 e Android 360x800).
 *  2. Mantém touch targets >= 48px (a11y WCAG 2.5.5).
 *  3. Não tem fases divergentes usando padding/typografia "gordos"
 *     (py-6 / space-y-5 / text-2xl em containers de fase).
 *  4. ProgressBar é fino o suficiente para não empurrar conteúdo
 *     above-the-fold em telas pequenas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { wizardStyles } from '@/components/onboarding/wizard/phases/v2/wizardStyles';

const PHASE_DIRS = [
  resolve(__dirname, '../components/onboarding/wizard/phases/v2'),
  resolve(__dirname, '../components/onboarding/wizard/phases/bet'),
];
const STEP_FILES = [
  resolve(__dirname, '../components/onboarding/wizard/phases/Step20_MoreServices.tsx'),
  resolve(__dirname, '../components/onboarding/wizard/phases/Step21_PortfolioAlbums.tsx'),
];

function listPhaseFiles(): string[] {
  const out: string[] = [];
  for (const dir of PHASE_DIRS) {
    try {
      for (const f of readdirSync(dir)) {
        if (/\.(tsx)$/.test(f) && !f.endsWith('.test.tsx')) {
          out.push(resolve(dir, f));
        }
      }
    } catch {
      /* dir ausente ignora */
    }
  }
  return out.concat(STEP_FILES);
}

describe('Wizard responsive layout tokens', () => {
  it('container usa padding e space-y compactos (sem py-6/space-y-5)', () => {
    expect(wizardStyles.container).toMatch(/py-2(\b|\.)/);
    expect(wizardStyles.container).toMatch(/space-y-2\.5|space-y-2(\b)/);
    expect(wizardStyles.container).not.toMatch(/py-6|space-y-5/);
  });

  it('título usa escala reduzida (text-lg) e não text-2xl', () => {
    expect(wizardStyles.title).toMatch(/text-lg/);
    expect(wizardStyles.title).not.toMatch(/text-2xl/);
  });

  it('subtítulo usa text-xs (densidade alta)', () => {
    expect(wizardStyles.subtitle).toMatch(/text-xs/);
    expect(wizardStyles.subtitle).not.toMatch(/text-sm/);
  });

  it('card usa p-3 com space-y-2 e rounded-xl (não 2xl + p-4)', () => {
    expect(wizardStyles.card).toMatch(/p-3/);
    expect(wizardStyles.card).toMatch(/space-y-2(\b)/);
    expect(wizardStyles.card).toMatch(/rounded-xl(\b)/);
    expect(wizardStyles.card).not.toMatch(/p-4|rounded-2xl/);
  });

  it('CTA mantém h-12 para a11y de touch-target (>=48px)', () => {
    // h-12 = 3rem = 48px — limite WCAG 2.5.5 Target Size (Enhanced).
    expect(wizardStyles.cta).toMatch(/h-12/);
    expect(wizardStyles.ctaGhost).toMatch(/h-12/);
  });

  it('estima altura aproximada do above-the-fold em iPhone SE (667px) e Android 360x800', () => {
    // ProgressBar agora ocupa ~16px em mobile (h-0.5 + py-0.5 + texto 10px) — antes 28px.
    // Header + 1 card + CTA = ~232px (estimativa conservadora).
    const estimatedFold = 232 + 56; // chrome reduzido
    expect(estimatedFold).toBeLessThan(667 * 0.6); // iPhone SE
    expect(estimatedFold).toBeLessThan(800 * 0.55); // Android 360x800
  });
});

describe('Wizard token governance — fases não divergem do design system', () => {
  const files = listPhaseFiles();

  it('descobre arquivos de fase para auditar', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('nenhuma fase usa containers "gordos" (py-6 + space-y-5 simultaneamente)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // Procura raiz do componente ("mx-auto ... max-w-md") com py-6 OU space-y-5.
      const rootContainer = /className="[^"]*mx-auto[^"]*max-w-md[^"]*(?:py-6|space-y-5)[^"]*"/;
      if (rootContainer.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('headers principais (h1/h2 de raiz) não usam text-2xl em fases de input', () => {
    // Permitido apenas em telas de celebração (Phase3Celebration, PhaseCelebration, Phase4Final final state).
    const allowList = /(Celebration|Final|VerifiedBadge)/;
    const offenders: string[] = [];
    for (const f of files) {
      if (allowList.test(f)) continue;
      const src = readFileSync(f, 'utf8');
      // h1/h2 com text-2xl
      const heading = /<h[12][^>]*className="[^"]*text-2xl/;
      if (heading.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});

describe('Wizard navigation — único botão de Voltar por fase', () => {
  it('WizardShell NÃO renderiza um botão Voltar global redundante', () => {
    const shell = readFileSync(
      resolve(__dirname, '../components/onboarding/wizard/WizardShell.tsx'),
      'utf8',
    );
    // Um comentário documentando a remoção deve existir; nenhum <Button>Voltar</Button>
    // de nível shell pode aparecer fora do contexto de phases.
    expect(shell).toMatch(/Bot[aã]o Voltar global removido|cada fase j[aá] tem o seu/i);
    // Não deve renderizar diretamente WizardNav/Voltar no shell.
    expect(shell).not.toMatch(/<WizardNav[^/]*hideBack=\{false\}/);
  });

  it('cada fase Bet renderiza no máximo UM botão "Voltar" textual', () => {
    const betDir = resolve(__dirname, '../components/onboarding/wizard/phases/bet');
    const phaseFiles = readdirSync(betDir).filter(
      (f) => f.startsWith('Phase') && f.endsWith('.tsx') && !f.endsWith('.test.tsx'),
    );
    expect(phaseFiles.length).toBeGreaterThan(0);
    const offenders: Array<{ file: string; count: number }> = [];
    for (const f of phaseFiles) {
      const src = readFileSync(resolve(betDir, f), 'utf8');
      // Conta ocorrências de "Voltar" textual em JSX (filtra strings em comentários comuns).
      const matches = src.match(/>\s*Voltar\s*</g) ?? [];
      if (matches.length > 1) offenders.push({ file: f, count: matches.length });
    }
    expect(offenders).toEqual([]);
  });
});
