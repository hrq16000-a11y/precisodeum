/**
 * Regressão "future-proof": providers legados podem chegar com QUALQUER
 * campo novo ausente ou nulo (ex.: geo_source_confidence, geo_source,
 * neighborhood_source, latitude, longitude, status, plus campos extras
 * que venham a ser adicionados depois). Em todos esses cenários:
 *
 *  1. O componente NUNCA pode quebrar (throw / NaN / "undefined" no DOM).
 *  2. Itens dependentes do campo nulo permanecem PENDENTES.
 *  3. Itens independentes continuam funcionando normalmente.
 *
 * Este arquivo complementa profile-location-checklist-null-fallback.test.tsx
 * focando em campos novos/desconhecidos e combinações extremas.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileLocationChecklist from '@/components/dashboard/ProfileLocationChecklist';

const renderChecklist = (provider: any) =>
  render(
    <MemoryRouter>
      <ProfileLocationChecklist provider={provider} />
    </MemoryRouter>,
  );

const FORBIDDEN_TOKENS = [/NaN/, /undefined/, /\[object Object\]/, /null,\s*null/];

const expectNoBrokenRender = () => {
  for (const re of FORBIDDEN_TOKENS) {
    expect(document.body.textContent || '').not.toMatch(re);
  }
};

describe('ProfileLocationChecklist · providers legados com campos novos/extra nulos', () => {
  it('provider {} totalmente vazio renderiza 3 pendentes sem quebrar', () => {
    renderChecklist({});
    expect(screen.getByText(/0 de 3 itens completos/i)).toBeInTheDocument();
    expect(screen.getByText(/Incompleto/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('provider só com status="pending" (todo o resto undefined) não quebra', () => {
    renderChecklist({ status: 'pending' });
    expect(screen.getByText(/0 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('campos extras desconhecidos (futuras colunas) são ignorados sem crash', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      // simulação de colunas que podem ser adicionadas no futuro
      geo_source_provider: null,
      geo_capture_method: null,
      bairro_confidence: null,
      service_area_radius_km: null,
      precise_address_consent: null,
      experimental_field_xyz: null,
      status: 'pending',
    } as any);

    expect(screen.getByText(/3 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('strings vazias em city/state/neighborhood contam como pendentes', () => {
    renderChecklist({
      city: '',
      state: '',
      neighborhood: '',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      status: 'pending',
    });
    // Apenas coords OK
    expect(screen.getByText(/1 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('state com tamanho inválido (1 char ou 3+) mantém "Cidade e estado" pendente', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'P', // inválido
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      status: 'pending',
    });
    expect(screen.getByText(/2 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('latitude/longitude como strings legadas não quebra (typeof !== number)', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: '-25.42' as unknown as number,
      longitude: '-49.27' as unknown as number,
      status: 'pending',
    });
    // Coords inválidas → 2/3
    expect(screen.getByText(/2 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('latitude/longitude NaN/Infinity não passam no Number.isFinite', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: Number.NaN,
      longitude: Number.POSITIVE_INFINITY,
      status: 'pending',
    });
    expect(screen.getByText(/2 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('neighborhood_source com valor desconhecido (ex: "imported_v1") deixa pendente', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'imported_v1' as any,
      latitude: -25.42,
      longitude: -49.27,
      status: 'pending',
    });
    expect(screen.getByText(/2 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('status NULL (legado pré-flag) é tratado como não-active e renderiza checklist', () => {
    renderChecklist({
      city: null,
      state: null,
      neighborhood: null,
      latitude: null,
      longitude: null,
      status: null,
    });
    expect(screen.getByText(/0 de 3 itens completos/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });

  it('status com case misto ("Active") é normalizado e oculta o componente', () => {
    const { container } = renderChecklist({
      city: null,
      status: 'Active',
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('geo_source_confidence = 0 (legado) não vira "±0m" porque coords ausentes', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: null,
      longitude: null,
      geo_source: 'gps',
      geo_source_confidence: 0,
      status: 'pending',
    });
    expect(document.body.textContent).not.toMatch(/±0m/);
    expect(document.body.textContent).not.toMatch(/GPS preciso/);
    expectNoBrokenRender();
  });

  it('geo_source_confidence negativo (dado corrompido) não vira badge inválido', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      geo_source: 'gps',
      geo_source_confidence: -50 as number,
      status: 'pending',
    });
    // Comportamento atual: ainda é typeof number → renderiza, mas sem NaN/undefined
    expectNoBrokenRender();
  });

  it('todos os campos com type errado simultaneamente não quebram (defesa em profundidade)', () => {
    renderChecklist({
      city: 123 as any,
      state: { uf: 'PR' } as any,
      neighborhood: ['Batel'] as any,
      neighborhood_source: 42 as any,
      latitude: 'lat' as any,
      longitude: null,
      geo_source: true as any,
      geo_source_confidence: {} as any,
      status: 'pending',
    });
    // Não deve crashar; deve renderizar o card
    expect(screen.getByText(/Localização do seu perfil/i)).toBeInTheDocument();
    expectNoBrokenRender();
  });
});
