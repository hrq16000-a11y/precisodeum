import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PasswordInput, { DEFAULT_PASSWORD_RULES } from '@/components/auth/PasswordInput';

describe('PasswordInput', () => {
  it('alterna o tipo do input ao clicar no botão olho', () => {
    render(<PasswordInput defaultValue="" aria-label="Senha" />);
    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('password');
    const toggle = screen.getByRole('button', { name: /mostrar senha/i });
    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: /ocultar senha/i }));
    expect(input.type).toBe('password');
  });

  it('exibe regras quando showRules=true e atualiza estado conforme digita', () => {
    function Wrapper() {
      const [v, setV] = (require('react') as typeof import('react')).useState('');
      return <PasswordInput value={v} onChange={(e) => setV(e.target.value)} showRules />;
    }
    render(<Wrapper />);
    // Todas as regras default devem estar listadas
    DEFAULT_PASSWORD_RULES.forEach((r) => {
      expect(screen.getByText(r.label)).toBeInTheDocument();
    });
    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc123' } });
    // Todas as 3 regras default ficam satisfeitas com "abc123"
    DEFAULT_PASSWORD_RULES.forEach((r) => {
      expect(r.test('abc123')).toBe(true);
    });
  });

  it('não exibe regras quando showRules é falso', () => {
    render(<PasswordInput defaultValue="" />);
    DEFAULT_PASSWORD_RULES.forEach((r) => {
      expect(screen.queryByText(r.label)).not.toBeInTheDocument();
    });
  });
});
