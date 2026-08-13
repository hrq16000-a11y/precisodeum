/**
 * Motion global de overlays (modais e toasts) + estados interativos.
 *
 * Trava:
 *  - modais/overlays animam só opacity/transform (zero CLS) e ficam em camada fixa;
 *  - `prefers-reduced-motion` neutraliza animação/transição de overlays e toasts;
 *  - o modal permanece centralizado durante a animação (translate preservado);
 *  - toasts do Sonner vivem em camada `position: fixed` (não empurram o layout);
 *  - hover/focus/click consistentes via `.motion-interactive`.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

describe('Overlays · CSS de motion', () => {
  it('declara as classes de overlay, superfície e modal centralizado', () => {
    for (const cls of ['.motion-overlay', '.motion-surface', '.motion-dialog', '.motion-interactive']) {
      expect(css, `classe ${cls} ausente`).toContain(cls);
    }
  });

  it('animação do modal preserva o centro (sem salto de layout)', () => {
    const kf = css.slice(css.indexOf('@keyframes motionDialogIn'));
    expect(kf).toContain('translate(-50%, -50%) scale(0.97)');
    expect(kf).toContain('translate(-50%, -50%) scale(1)');
    expect(kf.slice(0, 200)).not.toMatch(/(width|height|margin|padding)\s*:/);
  });

  it('toasts do Sonner ficam em camada fixa (não geram CLS)', () => {
    expect(css).toContain('[data-sonner-toaster] { position: fixed !important; }');
  });

  it('prefers-reduced-motion neutraliza overlays, modais e toasts', () => {
    const block = css.slice(css.indexOf('.motion-overlay'));
    const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const sel of ['.motion-overlay', '.motion-surface', '[data-sonner-toast]']) {
      expect(reduced, `${sel} não neutralizado`).toContain(sel);
    }
    expect(reduced).toContain('animation: none !important');
    expect(reduced).toContain('transition: none !important');
  });

  it('reduced-motion mantém o modal visível e centralizado', () => {
    const tail = css.slice(css.indexOf('@keyframes motionDialogIn'));
    expect(tail).toContain('transform: translate(-50%, -50%) !important');
    expect(tail).toContain('opacity: 1 !important');
  });

  it('estados interativos cobrem hover, active e focus-visible', () => {
    expect(css).toContain('.motion-interactive:hover');
    expect(css).toContain('.motion-interactive:active');
    expect(css).toContain('.motion-interactive:focus-visible');
  });
});

describe('Overlays · componentes', () => {
  it('Dialog usa as classes do design system (sem animate-in solto)', () => {
    const src = read('src/components/ui/dialog.tsx');
    expect(src).toContain('motion-overlay');
    expect(src).toContain('motion-dialog');
    expect(src).not.toContain('animate-in');
  });

  it('AlertDialog segue o mesmo contrato', () => {
    const src = read('src/components/ui/alert-dialog.tsx');
    expect(src).toContain('motion-overlay');
    expect(src).toContain('motion-dialog');
    expect(src).not.toContain('animate-in');
  });

  it('Toaster aplica transições consistentes nos toasts', () => {
    expect(read('src/components/ui/sonner.tsx')).toContain('motion-interactive');
  });

  it('modal aberto renderiza conteúdo acessível em camada fixa', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <p>corpo</p>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('motion-dialog');
    expect(dialog.className).toContain('fixed');
    expect(screen.getByText('Confirmar exclusão')).toBeInTheDocument();
  });

  it('modal fechado não deixa resíduo no fluxo do documento', () => {
    const { container } = render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Oculto</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
