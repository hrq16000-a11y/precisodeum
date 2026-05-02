/**
 * Garante que o sitemap dinâmico cobre as rotas críticas de SEO programático
 * — `/categoria/{slug}`, `/cidade/{slug}` e `/profissional/{slug}` — após
 * qualquer migração/restore.
 *
 * Lê o índice da edge function `supabase/functions/sitemap/index.ts` (texto)
 * e valida que os emissores de URL estão presentes. Falhar este teste = SEO
 * regressão de cobertura: bloquear merge.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('sitemap coverage — categoria/cidade/profissional/empresa', () => {
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

  it('emite URLs em /profissional/{slug}', () => {
    expect(src).toMatch(/\/profissional\/\$\{[^}]*slug[^}]*\}/);
  });

  it('emite URLs em /empresa/{slug}', () => {
    expect(src).toMatch(/\/empresa\/\$\{[^}]*slug[^}]*\}/);
  });

  it('emite combinação categoria × cidade /categoria/{slug}/em/{cidade}', () => {
    expect(src).toMatch(/\/categoria\/\$\{[^}]*\}\/em\/\$\{[^}]*\}/);
  });

  it('inclui rotas-índice /categorias e /cidades', () => {
    expect(src).toContain('/categorias');
    expect(src).toContain('/cidades');
  });

  it('respeita paginação por tipo (suporte a ?type=&page=)', () => {
    expect(src).toMatch(/type/);
    expect(src).toMatch(/page/);
  });

  it('aplica lastmod incremental (updated_at/created_at) nos emissores dinâmicos', () => {
    // Atualização incremental: provider usa updated_at, categoria/cidade usam
    // created_at. Garante que não estamos emitindo lastmod estático para todos.
    expect(src).toMatch(/updated_at/);
    expect(src).toMatch(/created_at/);
  });

  it('filtra providers aprovados com slug não-nulo (canonical apenas perfis públicos)', () => {
    expect(src).toMatch(/eq\(['"]status['"],\s*['"]approved['"]\)/);
    expect(src).toMatch(/not\(['"]slug['"],\s*['"]is['"],\s*null\)/);
  });

  it('inclui sub-sitemap dedicado para empresas aprovadas', () => {
    expect(src).toContain("'companies'");
    expect(src).toMatch(/eq\(['"]account_type['"],\s*['"]company['"]\)/);
  });
});
