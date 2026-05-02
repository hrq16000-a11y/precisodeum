/**
 * Regressão: pular detalhes do 1º serviço NÃO joga o usuário no /dashboard.
 *
 * Bug reportado em 2026-05-02: o botão "Salvar progresso e configurar meu
 * painel depois" em Phase2Details fazia `window.location.assign('/dashboard')`,
 * pulando completamente a fase de fotos. O wizard deve manter o usuário no
 * circuito (viciante), permitindo voltar/pular cada etapa, mas nunca
 * encurtando o fluxo prematuramente.
 *
 * Esse teste lê o código-fonte do OnboardingV2Shell e garante que o handler
 * onSkip do case `phase2_details` NÃO contém `location.assign('/dashboard')`
 * nem `navigate('/dashboard')`, e que despacha `GO_TO phase2_photos`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHELL_PATH = resolve(
  process.cwd(),
  'src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx',
);

describe('Wizard · pular detalhes não joga no /dashboard', () => {
  const src = readFileSync(SHELL_PATH, 'utf8');

  // Pega o ÚLTIMO case 'phase2_details' (o do switch de renderPhase, que é o
  // que efetivamente roda ao usuário clicar). Existem outros matches em
  // switches auxiliares (ex.: meta() para milestone) que não interessam aqui.
  const detailsStart = src.lastIndexOf("case 'phase2_details':");
  // Próximo "case 'xxx':" após o nosso bloco
  const after = src.slice(detailsStart + 1);
  const nextCaseRel = after.search(/\n\s+case '[a-z0-9_]+':/);
  const detailsEnd = nextCaseRel >= 0 ? detailsStart + 1 + nextCaseRel : src.length;
  const block = src.slice(detailsStart, detailsEnd);

  it('contém o case phase2_details', () => {
    expect(detailsStart).toBeGreaterThan(-1);
    expect(detailsEnd).toBeGreaterThan(detailsStart);
  });

  it('NÃO chama window.location.assign("/dashboard") em onSkip', () => {
    expect(block).not.toMatch(/location\.assign\(['"]\/dashboard['"]\)/);
  });

  it('NÃO chama navigate("/dashboard") em onSkip', () => {
    expect(block).not.toMatch(/navigate\(['"]\/dashboard['"]\)/);
  });

  it('despacha GO_TO phase2_photos após salvar', () => {
    expect(block).toMatch(/GO_TO[^}]*phase2_photos/);
  });

  it('mantém persistFirstService() antes de avançar', () => {
    expect(block).toMatch(/persistFirstService\(\)/);
  });
});
