import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function read(p: string) {
  return fs.readFileSync(path.resolve(root, p), 'utf-8');
}

describe('DashboardPortfolioPage — regressão do slot de fotos', () => {
  it('não renderiza mais o card bloqueado para a próxima foto dentro do álbum', () => {
    const src = read('pages/DashboardPortfolioPage.tsx');

    expect(src).not.toContain("<LockedSlotCard label={`Foto ${photos.length + 1}`} variant=\"compact\" />");
    expect(src).toContain('Adicione a próxima foto para continuar preenchendo seu álbum.');
    expect(src).toContain('type="file"');
  });

  it('mantém o bloqueio progressivo apenas para novos álbuns na visão geral', () => {
    const src = read('pages/DashboardPortfolioPage.tsx');

    expect(src).toContain('<LockedSlotCard label={`Álbum ${albums.length + 1}`} />');
  });
});