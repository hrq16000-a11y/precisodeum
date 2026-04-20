import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * BLINDAGEM — FeaturedProviders Card Layout
 * Estes testes garantem que o layout do card de profissional em destaque
 * nunca volte a quebrar (altura excessiva, botões desalinhados, texto estourando).
 * Se algum destes invariantes for removido, o teste falha.
 */
describe('FeaturedProviders card — layout invariants (anti-regression shield)', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/home/FeaturedProviders.tsx'),
    'utf-8'
  );

  it('NÃO deve impor min-height fixo que infla o card', () => {
    expect(source).not.toMatch(/min-h-\[260px\]/);
    expect(source).not.toMatch(/min-h-\[280px\]/);
  });

  it('NÃO deve usar spacer flex-1 vazio que estica o card', () => {
    expect(source).not.toMatch(/<div className="flex-1"\s*\/>/);
  });

  it('deve manter padding compacto no mobile (p-3) e maior no desktop (sm:p-4)', () => {
    expect(source).toMatch(/p-3 sm:p-4/);
  });

  it('botões devem usar flex-1 basis para distribuição equilibrada', () => {
    expect(source).toMatch(/flex-1 basis-\[120px\]/); // WhatsApp
    expect(source).toMatch(/flex-1 basis-\[100px\]/); // Ver Perfil
  });

  it('container de botões deve permitir wrap em telas extremamente estreitas', () => {
    expect(source).toMatch(/flex-wrap/);
  });

  it('nome do profissional deve truncar em 2 linhas (anti-overflow)', () => {
    expect(source).toMatch(/WebkitLineClamp:\s*2/);
    expect(source).toMatch(/WebkitBoxOrient:\s*['"]vertical['"]/);
  });

  it('avatar deve usar object-cover e shrink-0 (não distorce nem desloca)', () => {
    expect(source).toMatch(/object-cover/);
    expect(source).toMatch(/shrink-0/);
  });

  it('crown badge (destaque) deve ser absolute (não desloca o nome)', () => {
    expect(source).toMatch(/absolute right-2 top-3/);
  });

  it('card deve ter no máximo 90% de largura no mobile', () => {
    expect(source).toMatch(/max-w-\[90%\]/);
    expect(source).toMatch(/sm:max-w-none/);
  });

  it('min-w-0 deve estar presente para permitir shrink correto do flex', () => {
    const occurrences = (source.match(/min-w-0/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(5);
  });
});
