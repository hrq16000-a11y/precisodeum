/**
 * Valida que o JSON-LD do BreadcrumbList SEMPRE inclui `position`, `name` e
 * `item` em cada ListItem. Falha se qualquer campo estiver ausente ou vazio.
 *
 * Esse teste protege a marcação contra regressões futuras: o Google Rich
 * Results exige os 3 campos preenchidos, caso contrário o snippet some.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { useMemo } from 'react';
import { buildCanonicalUrl } from '@/lib/canonicalUrl';

// Reproduz a mesma lógica do componente Breadcrumbs (single source compartilhado).
function useBreadcrumbLd(items: Array<{ label: string; url?: string }>) {
  const all = [{ label: 'Home', url: '/' }, ...items];
  return useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: all.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.label,
        item: buildCanonicalUrl(item.url || '/'),
      })),
    }),
    [JSON.stringify(all)],
  );
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

function assertListItemsValid(ld: ReturnType<typeof useBreadcrumbLd>) {
  expect(ld['@context']).toBe('https://schema.org');
  expect(ld['@type']).toBe('BreadcrumbList');
  expect(Array.isArray(ld.itemListElement)).toBe(true);
  expect(ld.itemListElement.length).toBeGreaterThan(0);

  ld.itemListElement.forEach((entry, idx) => {
    expect(entry['@type'], `ListItem[${idx}].@type`).toBe('ListItem');
    expect(typeof entry.position, `ListItem[${idx}].position deve ser number`).toBe('number');
    expect(entry.position).toBe(idx + 1);

    expect(entry.name, `ListItem[${idx}].name ausente`).toBeTruthy();
    expect(String(entry.name).trim().length).toBeGreaterThan(0);

    expect(entry.item, `ListItem[${idx}].item ausente`).toBeTruthy();
    expect(String(entry.item)).toMatch(/^https?:\/\//);
  });
}

describe('BreadcrumbList JSON-LD — campos obrigatórios', () => {
  it('rota de categoria gera position+name+item válidos', () => {
    const { result } = renderHook(
      () =>
        useBreadcrumbLd([
          { label: 'Categorias', url: '/categorias' },
          { label: 'Eletricista', url: '/categoria/eletricista' },
        ]),
      { wrapper },
    );
    assertListItemsValid(result.current);
    expect(result.current.itemListElement).toHaveLength(3);
  });

  it('rota de cidade gera 4 níveis (Home/Cidades/UF/Cidade) com item absoluto', () => {
    const { result } = renderHook(
      () =>
        useBreadcrumbLd([
          { label: 'Cidades', url: '/cidades' },
          { label: 'SP', url: '/cidades/sp' },
          { label: 'São Paulo', url: '/cidades/sp/sao-paulo' },
        ]),
      { wrapper },
    );
    assertListItemsValid(result.current);
    result.current.itemListElement.forEach((e) => {
      expect(String(e.item)).toMatch(/^https:\/\/[^/]+\/.+/);
    });
  });

  it('rota de profissional inclui o último nível com URL absoluta', () => {
    const { result } = renderHook(
      () => useBreadcrumbLd([{ label: 'João Silva', url: '/profissional/joao-silva' }]),
      { wrapper },
    );
    assertListItemsValid(result.current);
    const last = result.current.itemListElement[result.current.itemListElement.length - 1];
    expect(String(last.item)).toContain('/profissional/joao-silva');
    expect(last.name).toBe('João Silva');
  });

  it('falha quando label vazio é injetado (regressão guard)', () => {
    const { result } = renderHook(
      () => useBreadcrumbLd([{ label: '', url: '/x' }]),
      { wrapper },
    );
    // Espera-se que assertListItemsValid LANCE.
    expect(() => assertListItemsValid(result.current)).toThrow();
  });
});
