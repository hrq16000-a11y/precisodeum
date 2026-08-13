import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { Skeleton } from '@/components/ui/skeleton';
import AsyncBoundary from '@/components/motion/AsyncBoundary';
import LazyImage from '@/components/motion/LazyImage';
import ProgressIndicator from '@/components/motion/ProgressIndicator';
import Reveal from '@/components/motion/Reveal';
import { SkeletonCardGrid } from '@/components/motion/Skeletons';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('Motion system · primitivas CSS', () => {
  it('define as classes de entrada, saída, shimmer e progresso', () => {
    for (const cls of [
      '.motion-enter',
      '.motion-enter-fade',
      '.motion-enter-scale',
      '.motion-exit',
      '.motion-indeterminate',
      '.motion-stagger',
      '.skeleton-shimmer',
      '.motion-img',
    ]) {
      expect(css, `classe ${cls} ausente`).toContain(cls);
    }
  });

  it('neutraliza animações com prefers-reduced-motion', () => {
    const block = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('.motion-enter');
    expect(block).toContain('.skeleton-shimmer::after');
    expect(block).toContain('animation: none !important');
  });
});

describe('Motion system · componentes', () => {
  it('Skeleton usa shimmer e não pulse', () => {
    const { container } = render(<Skeleton className="h-4 w-10" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('skeleton-shimmer');
    expect(el.className).not.toContain('animate-pulse');
  });

  it('AsyncBoundary mostra skeleton enquanto carrega (nunca tela em branco)', () => {
    render(
      <AsyncBoundary loading skeleton={<SkeletonCardGrid count={2} />}>
        <p>conteúdo</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole('status', { name: /carregando itens/i })).toBeInTheDocument();
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument();
  });

  it('AsyncBoundary trata permissão negada sem exibir dados', () => {
    render(
      <AsyncBoundary
        error={{ code: '42501', message: 'permission denied for table profiles' }}
        skeleton={<SkeletonCardGrid />}
      >
        <p>dados sensíveis</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByText('dados sensíveis')).not.toBeInTheDocument();
  });

  it('AsyncBoundary mostra estado vazio em vez de área em branco', () => {
    render(
      <AsyncBoundary empty skeleton={<SkeletonCardGrid />} emptyTitle="Sem resultados">
        <p>lista</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText('Sem resultados')).toBeInTheDocument();
  });

  it('LazyImage aplica lazy loading, placeholder e fade ao carregar', () => {
    const { container } = render(<LazyImage src="/x.jpg" alt="foto" aspect="16 / 9" />);
    const wrapper = container.firstElementChild!;
    const img = container.querySelector('img')!;
    expect(wrapper.className).toContain('skeleton-shimmer');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('data-loaded')).toBe('false');
    expect(img.className).toContain('motion-img');
  });

  it('LazyImage com priority carrega ansiosamente (LCP)', () => {
    const { container } = render(<LazyImage src="/hero.jpg" alt="hero" priority />);
    expect(container.querySelector('img')!.getAttribute('loading')).toBe('eager');
  });

  it('ProgressIndicator suporta modo determinado e indeterminado', () => {
    const { rerender } = render(<ProgressIndicator value={40} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    rerender(<ProgressIndicator />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('Reveal renderiza conteúdo mesmo sem IntersectionObserver', () => {
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error simulando ambiente sem suporte
    globalThis.IntersectionObserver = undefined;
    render(<Reveal>visível</Reveal>);
    expect(screen.getByText('visível')).toBeInTheDocument();
    globalThis.IntersectionObserver = original;
  });

  it('Reveal observa a viewport quando disponível', () => {
    const observe = vi.fn();
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error stub simples
    globalThis.IntersectionObserver = class {
      observe = observe;
      disconnect = vi.fn();
    };
    render(<Reveal onViewport>bloco</Reveal>);
    expect(observe).toHaveBeenCalled();
    globalThis.IntersectionObserver = original;
  });
});
