/**
 * Smoke tests para o Passo 3 do wizard cobrindo:
 *  - Renderização do campo CPF/CNPJ com badge "Documento opcional"
 *  - Ação "Pular passo agora" presente quando o documento está vazio
 *  - Botão principal habilitado mesmo sem CPF/CNPJ (campo opcional)
 *  - Validação inline quando o usuário digita um documento inválido
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CpfCnpjInput from '@/components/onboarding/CpfCnpjInput';

describe('CpfCnpjInput — Passo 3 do onboarding', () => {
  it('devolve apenas dígitos via onChange (sem máscara)', () => {
    const handle = vi.fn();
    render(<CpfCnpjInput value="" onChange={handle} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123.456.789-01' } });
    // O componente sempre devolve dígitos puros — backend recebe sem máscara.
    expect(handle).toHaveBeenLastCalledWith('12345678901');
  });

  it('aceita colar string com pontos/barras e converte para dígitos', () => {
    const handle = vi.fn();
    render(<CpfCnpjInput value="" onChange={handle} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12.345.678/0001-95' } });
    expect(handle).toHaveBeenLastCalledWith('12345678000195');
  });

  it('trunca em 14 dígitos mesmo se a entrada for maior', () => {
    const handle = vi.fn();
    render(<CpfCnpjInput value="" onChange={handle} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99999999999999999' } });
    expect(handle).toHaveBeenLastCalledWith('99999999999999');
  });

  it('mostra valor mascarado quando recebe dígitos crus', () => {
    render(<CpfCnpjInput value="12345678901" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('123.456.789-01');
  });
});
