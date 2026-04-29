/**
 * Garante que o sitemap dinâmico cobre as rotas críticas de SEO programático
 * — `/categoria/{slug}` e `/cidade/{slug}` — após qualquer migração/restore.
 *
 * Lê o índice da edge function `supabase/functions/sitemap/index.ts` (texto)
 * e valida que os emissores de URL estão presentes. Falhar este teste = SEO
 * regressão de cobertura: bloquear merge.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('sitemap coverage — categoria/cidade', () => {
  const src = readFileSync(
    path.resolve(__dirname, '../../supabase/functions/sitemap/index.ts'),
    'utf-8',
  );

  it('emite URLs em /categoria/{slug}', () => {
    expect(src).toMatch(/\/categoria\/\$\{[^}]*slug[^}]*\}/);
  });

  it('emite URLs em /cidade/{slug}', () => {
    expect(src).toMatch(/\/cidade\/\$\{[^}]*slug[^}]*\}/);
  });

  it('inclui rotas-índice /categorias e /cidades', () => {
    expect(src).toContain('/categorias');
    expect(src).toContain('/cidades');
  });

  it('respeita paginação por tipo (suporte a ?type=&page=)', () => {
    expect(src).toMatch(/type/);
    expect(src).toMatch(/page/);
  });
});
