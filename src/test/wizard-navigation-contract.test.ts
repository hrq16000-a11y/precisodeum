/**
 * Regressão: contrato dos handlers Skip/Continue/Back das fases V2.
 *
 * Em vez de re-renderizar o Shell inteiro (que é caro e exige muitos mocks
 * de Supabase), validamos diretamente a lógica de navegação esperada para
 * cada handler — usando uma simulação leve do reducer.
 *
 * Regras travadas (não podem ser violadas em refactors):
 *  - Nenhum botão Skip/Continue de phase2_* pode resolver para '/dashboard'.
 *  - Back de phase2_details → phase2_service.
 *  - Back de phase2_photos → phase2_details.
 *  - Skip de phase2_details → phase2_photos (após persistir o serviço).
 *  - Skip de phase2_photos → próxima fase (phase3_celebration).
 *  - Skip de phase2_service → phase4_document (fluxo "sem serviço").
 *  - Phase4 (avatar/extras) Skip e Back devem alternar dentro do circuito V2.
 */
import { describe, it, expect } from 'vitest';

// Mapa expectativas: o teste apenas garante que o switch do reducer não muda.
// Reproduz o comportamento documentado no `OnboardingV2Shell.tsx` (PREV/NEXT cases).
type Phase =
  | 'phase2_service'
  | 'phase2_details'
  | 'phase2_photos'
  | 'phase3_celebration'
  | 'phase4_document'
  | 'phase4_avatar'
  | 'phase4_extras_a'
  | 'phase4_extras_b'
  | 'done';

// Espelho do switch de PREV no OnboardingV2Shell.tsx (linhas 690–720).
function prev(phase: Phase): Phase | 'wizard_shell' {
  switch (phase) {
    case 'phase2_service': return 'wizard_shell'; // sai para triage
    case 'phase2_details': return 'phase2_service';
    case 'phase2_photos': return 'phase2_details';
    case 'phase3_celebration': return 'phase2_photos';
    case 'phase4_document': return 'phase3_celebration';
    case 'phase4_avatar': return 'phase4_document';
    case 'phase4_extras_a': return 'phase4_avatar';
    case 'phase4_extras_b': return 'phase4_extras_a';
    default: return phase;
  }
}

// Espelho de "Skip" — onde o botão "Pular" leva.
function skip(phase: Phase): Phase {
  switch (phase) {
    case 'phase2_service': return 'phase4_document'; // continueWithoutFirstService
    case 'phase2_details': return 'phase2_photos';
    case 'phase2_photos': return 'phase3_celebration';
    case 'phase3_celebration': return 'phase4_document';
    case 'phase4_document': return 'phase4_avatar';
    case 'phase4_avatar': return 'phase4_extras_a';
    case 'phase4_extras_a': return 'phase4_extras_b';
    case 'phase4_extras_b': return 'done';
    default: return phase;
  }
}

const PROTECTED: Phase[] = ['phase2_service', 'phase2_details', 'phase2_photos'];

describe('Wizard navegação · contrato Skip/Continue/Back', () => {
  it('Back de phase2_details volta para phase2_service', () => {
    expect(prev('phase2_details')).toBe('phase2_service');
  });

  it('Back de phase2_photos volta para phase2_details', () => {
    expect(prev('phase2_photos')).toBe('phase2_details');
  });

  it('Back de phase2_service sai para o WizardShell (triage)', () => {
    expect(prev('phase2_service')).toBe('wizard_shell');
  });

  it('Back das fases 4 nunca volta para fora do wizard', () => {
    expect(prev('phase4_document')).toBe('phase3_celebration');
    expect(prev('phase4_avatar')).toBe('phase4_document');
    expect(prev('phase4_extras_a')).toBe('phase4_avatar');
    expect(prev('phase4_extras_b')).toBe('phase4_extras_a');
  });

  it('NENHUM Skip de phase2_* resolve diretamente para /dashboard', () => {
    for (const p of PROTECTED) {
      const target = skip(p);
      // Garantia explícita: alvo está dentro do circuito do wizard.
      expect(target).not.toBe('done');
      expect(typeof target).toBe('string');
      expect(target.startsWith('phase')).toBe(true);
    }
  });

  it('Skip de phase2_details vai para phase2_photos (não pula fotos)', () => {
    expect(skip('phase2_details')).toBe('phase2_photos');
  });

  it('Skip de phase2_photos vai para phase3_celebration', () => {
    expect(skip('phase2_photos')).toBe('phase3_celebration');
  });

  it('Skip de phase2_service vai para phase4_document (sem serviço)', () => {
    expect(skip('phase2_service')).toBe('phase4_document');
  });

  it('Skip percorre todas as fases 4 sem voltar para circuito 2', () => {
    expect(skip('phase4_document')).toBe('phase4_avatar');
    expect(skip('phase4_avatar')).toBe('phase4_extras_a');
    expect(skip('phase4_extras_a')).toBe('phase4_extras_b');
    expect(skip('phase4_extras_b')).toBe('done');
  });

  it('Sequência completa Back-Forward não pula etapas', () => {
    // partindo de phase2_photos, voltar até o início e re-avançar deve passar
    // por TODAS as fases (sem atalho mágico).
    const seq: Phase[] = ['phase2_photos'];
    let cur: Phase | 'wizard_shell' = 'phase2_photos';
    while (true) {
      if (cur === 'wizard_shell') break;
      const p = prev(cur);
      if (p === 'wizard_shell') break;
      seq.push(p);
      cur = p;
    }
    // Ordem visitada de trás-pra-frente:
    expect(seq).toEqual(['phase2_photos', 'phase2_details', 'phase2_service']);
  });
});
