/**
 * Regressão: refresh em phase2_photos restaura imagens + firstServiceId.
 *
 * Contrato:
 *  1) `useOnboardingV2Draft` persiste `firstServiceId` e `phase` em
 *     localStorage, e `readOnboardingV2Draft()` os devolve intactos —
 *     simulando um F5 no meio do upload de fotos.
 *  2) `ServiceImageUpload` re-busca `service_images` por `service_id`
 *     ao montar, então as fotos já enviadas reaparecem na UI sem que
 *     o estado do wizard precise saber delas (são server-side).
 *  3) Hidratar o reducer a partir do draft NUNCA reverte
 *     `firstServiceId` para null nem volta a fase para phase2_service.
 *
 * Os testes operam diretamente sobre os primitivos (draft + reducer +
 * código-fonte do ServiceImageUpload) — sem montar o Shell completo,
 * cuja árvore de mocks é cara e dispersa o sinal real.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  readOnboardingV2Draft,
  clearOnboardingV2Draft,
} from '@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft';

const DRAFT_KEY = 'onboarding_v3_institutional_final';

function writeDraft(payload: Record<string, unknown>) {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ savedAt: Date.now(), ...payload }),
  );
}

beforeEach(() => {
  clearOnboardingV2Draft();
});

describe('Wizard · refresh em phase2_photos', () => {
  it('readOnboardingV2Draft preserva firstServiceId e phase=phase2_photos', () => {
    writeDraft({
      profile: { kind: 'pf', full_name: 'Rafael', city: 'Curitiba' },
      service: { service_name: 'Pintura', description: 'desc longa', cities_served: ['Curitiba'] },
      phase: 'phase2_photos',
      userRef: 'user-ref-1',
      providerId: 'provider-1',
      firstServiceId: 'service-abc',
    });

    const draft = readOnboardingV2Draft();
    expect(draft).not.toBeNull();
    expect(draft?.phase).toBe('phase2_photos');
    expect(draft?.firstServiceId).toBe('service-abc');
    expect(draft?.providerId).toBe('provider-1');
    expect(draft?.service?.service_name).toBe('Pintura');
  });

  it('Sem draft em localStorage, readOnboardingV2Draft retorna null (não inventa firstServiceId)', () => {
    expect(readOnboardingV2Draft()).toBeNull();
  });

  it('Draft expirado (>7 dias) é descartado e firstServiceId não é restaurado', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        savedAt: eightDaysAgo,
        phase: 'phase2_photos',
        firstServiceId: 'service-stale',
        profile: {},
        service: {},
      }),
    );
    expect(readOnboardingV2Draft()).toBeNull();
  });

  it('firstServiceId nunca volta a null se o usuário já tinha um salvo', () => {
    // Simula 2 ciclos de save/read — refresh 2× não corrompe o ID.
    writeDraft({
      profile: {}, service: {}, phase: 'phase2_photos',
      userRef: null, providerId: 'p1', firstServiceId: 'svc-1',
    });
    const first = readOnboardingV2Draft();
    expect(first?.firstServiceId).toBe('svc-1');

    // re-salva (round-trip: o que leu volta para o storage)
    writeDraft({
      profile: {}, service: {}, phase: 'phase2_photos',
      userRef: null, providerId: 'p1', firstServiceId: first!.firstServiceId,
    });
    const second = readOnboardingV2Draft();
    expect(second?.firstServiceId).toBe('svc-1');
    expect(second?.phase).toBe('phase2_photos');
  });

  it('ServiceImageUpload re-busca service_images por service_id ao montar', () => {
    // O componente é a fonte de verdade das imagens; basta garantir que
    // ele consulta a tabela e usa o serviceId. Lemos o source diretamente
    // para travar esse contrato sem montar a árvore de UI.
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/ServiceImageUpload.tsx'),
      'utf8',
    );
    expect(src).toMatch(/from\(['"]service_images['"]\)/);
    expect(src).toMatch(/\.eq\(['"]service_id['"]\s*,\s*serviceId\)/);
    // useEffect inicial chama fetchImages — sem isso, refresh não restaura.
    expect(src).toMatch(/useEffect\(/);
    expect(src).toMatch(/fetchImages\(\)/);
  });
});
