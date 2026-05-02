/**
 * Regressão: ProfileLocationChecklist e providers legados com NULLs.
 *
 * Contrato (alinhado a docs/wizard-location-fields-no-migration.md):
 *  - geo_source NULL          → sem badge "preciso/aproximado", item GPS pode
 *                                continuar OK só com lat/lng presentes.
 *  - geo_source_confidence NULL → não exibe "(±Xm)", não vira NaN.
 *  - neighborhood_source NULL → item "bairro real" PENDENTE (igual a default_centro).
 *  - latitude/longitude NULL  → item "Coordenadas GPS" PENDENTE.
 *  - status='active'          → componente retorna null (guard anti-zumbi).
 *  - provider null/undefined  → componente retorna null sem quebrar.
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

describe('ProfileLocationChecklist · fallback NULL em providers legados', () => {
  it('provider null → não renderiza nada', () => {
    const { container } = renderChecklist(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('provider undefined → não renderiza nada', () => {
    const { container } = renderChecklist(undefined);
    expect(container).toBeEmptyDOMElement();
  });

  it('provider 100% legado (todos os campos de localização NULL) renderiza com 3 itens pendentes', () => {
    renderChecklist({
      city: null,
      state: null,
      neighborhood: null,
      neighborhood_source: null,
      latitude: null,
      longitude: null,
      geo_source: null,
      geo_source_confidence: null,
      status: 'pending',
    });

    // Cabeçalho mostra 0 de 3 completos + selo "Incompleto"
    expect(screen.getByText(/0 de 3 itens completos/i)).toBeInTheDocument();
    expect(screen.getByText(/Incompleto/i)).toBeInTheDocument();

    // 3 labels do checklist visíveis
    expect(screen.getByText(/Cidade e estado/i)).toBeInTheDocument();
    expect(screen.getByText(/Bairro real/i)).toBeInTheDocument();
    expect(screen.getByText(/Coordenadas GPS/i)).toBeInTheDocument();
  });

  it('NÃO exibe badge "preciso/aproximado" nem "±Xm" quando geo_source/confidence são NULL', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Centro Cívico',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      geo_source: null,
      geo_source_confidence: null,
      status: 'pending',
    });

    // Mensagem fallback genérica de proximidade — sem "preciso", "aproximado" ou "±"
    expect(
      screen.getByText(/ordenar por proximidade real/i),
    ).toBeInTheDocument();

    // Garante que NÃO houve render de NaN nem de "(±Xm)"
    expect(document.body.textContent).not.toMatch(/NaN/);
    expect(document.body.textContent).not.toMatch(/±\d+m/);
    expect(document.body.textContent).not.toMatch(/GPS preciso/);
    expect(document.body.textContent).not.toMatch(/GPS aproximado/);
  });

  it('neighborhood_source NULL deixa "bairro real" PENDENTE mesmo com texto preenchido', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Centro Cívico', // texto presente
      neighborhood_source: null,     // mas origem desconhecida (legado)
      latitude: -25.42,
      longitude: -49.27,
      status: 'pending',
    });

    // Cabeçalho deve mostrar 2/3 (cidade+coords OK; bairro pendente)
    expect(screen.getByText(/2 de 3 itens completos/i)).toBeInTheDocument();
  });

  it('neighborhood_source = "default_centro" também deixa o item PENDENTE com hint específico', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Centro',
      neighborhood_source: 'default_centro',
      latitude: -25.42,
      longitude: -49.27,
      status: 'pending',
    });

    expect(screen.getByText(/2 de 3 itens completos/i)).toBeInTheDocument();
    expect(
      screen.getByText(/preenchido como "Centro" automaticamente/i),
    ).toBeInTheDocument();
  });

  it('latitude/longitude NULL deixa "Coordenadas GPS" PENDENTE sem quebrar', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: null,
      longitude: null,
      status: 'pending',
    });

    expect(screen.getByText(/2 de 3 itens completos/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ordenar por proximidade real/i),
    ).toBeInTheDocument();
    // Sem badge de precisão de GPS
    expect(document.body.textContent).not.toMatch(/GPS preciso/);
    expect(document.body.textContent).not.toMatch(/GPS aproximado/);
  });

  it('GPS preciso (≤100m) exibe badge "GPS preciso (±Xm)" quando os campos NÃO são NULL', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      geo_source: 'gps',
      geo_source_confidence: 35,
      status: 'pending',
    });

    expect(screen.getByText(/GPS preciso \(±35m\)/i)).toBeInTheDocument();
  });

  it('GPS aproximado (>100m) exibe badge "GPS aproximado (±Xm)"', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      geo_source: 'gps',
      geo_source_confidence: 480,
      status: 'pending',
    });

    expect(screen.getByText(/GPS aproximado \(±480m\)/i)).toBeInTheDocument();
  });

  it('geo_source !== "gps" (ex.: "ip" legado) não exibe badge de precisão mesmo com confidence preenchido', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      geo_source: 'ip',
      geo_source_confidence: 5000,
      status: 'pending',
    });

    expect(document.body.textContent).not.toMatch(/GPS preciso/);
    expect(document.body.textContent).not.toMatch(/GPS aproximado/);
    expect(
      screen.getByText(/ordenar por proximidade real/i),
    ).toBeInTheDocument();
  });

  it('geo_source_confidence string inválida (legado) não vira NaN nem renderiza badge', () => {
    renderChecklist({
      city: 'Curitiba',
      state: 'PR',
      neighborhood: 'Batel',
      neighborhood_source: 'user',
      latitude: -25.42,
      longitude: -49.27,
      geo_source: 'gps',
      // simula registro legado mal-tipado (não passa no `typeof === 'number'`)
      geo_source_confidence: 'desconhecido' as unknown as number,
      status: 'pending',
    });

    expect(document.body.textContent).not.toMatch(/NaN/);
    expect(document.body.textContent).not.toMatch(/±/);
    expect(
      screen.getByText(/ordenar por proximidade real/i),
    ).toBeInTheDocument();
  });

  it('status="active" devolve null mesmo com NULLs (guard anti-zumbi)', () => {
    const { container } = renderChecklist({
      city: null,
      state: null,
      neighborhood: null,
      neighborhood_source: null,
      latitude: null,
      longitude: null,
      geo_source: null,
      geo_source_confidence: null,
      status: 'active',
    });
    expect(container).toBeEmptyDOMElement();
  });
});
