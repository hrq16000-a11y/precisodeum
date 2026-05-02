/**
 * Anti-regressão: AnimatedCounter precisa aceitar ref encaminhado.
 *
 * Antes da correção, consumidores como `TooltipTrigger asChild` ou
 * `Slot` do Radix injetavam um ref via cloneElement e o React emitia
 *   "Function components cannot be given refs. Attempts to access
 *    this ref will fail. Did you mean to use React.forwardRef()?"
 *
 * Depois do `forwardRef`, o ref externo é resolvido para o nó DOM
 * (motion.span). Este teste falha se alguém remover o forwardRef.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

describe('AnimatedCounter — forwardRef contract', () => {
  it('expõe o nó DOM via ref externo (createRef)', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<AnimatedCounter ref={ref} value={42} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    cleanup();
  });

  it('aceita callback ref e é chamado com o nó montado', () => {
    const cb = vi.fn();
    render(<AnimatedCounter ref={cb} value={10} />);
    // O callback recebeu o nó pelo menos uma vez com um HTMLElement.
    const calls = cb.mock.calls.filter(([n]) => n instanceof HTMLElement);
    expect(calls.length).toBeGreaterThan(0);
    cleanup();
  });

  it('não emite warning "Function components cannot be given refs"', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ref = createRef<HTMLSpanElement>();
    render(<AnimatedCounter ref={ref} value={7} />);
    const messages = errorSpy.mock.calls.map((c) => String(c[0] || ''));
    expect(messages.some((m) => /Function components cannot be given refs/i.test(m))).toBe(false);
    errorSpy.mockRestore();
    cleanup();
  });

  it('lida com value não-numérico/NaN sem quebrar (blindagem)', () => {
    expect(() => render(<AnimatedCounter value={'abc'} />)).not.toThrow();
    cleanup();
    expect(() => render(<AnimatedCounter value={Number.NaN as unknown as number} />)).not.toThrow();
    cleanup();
  });
});
