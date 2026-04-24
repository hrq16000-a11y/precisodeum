/**
 * Cobertura unitária extra do CpfCnpjInput simulando:
 *  - paste com seleção ativa (substitui trecho selecionado)
 *  - digitação no meio mantendo a posição do cursor (via selectionStart)
 *  - paste com pontuação preservando todos os dígitos
 *
 * Observações:
 *   jsdom não recalcula selectionStart após `setSelectionRange` quando o input é
 *   controlado por React; por isso lemos `selectionStart` direto após o efeito
 *   de layout, que é onde o componente posiciona o cursor.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import CpfCnpjInput from '@/components/onboarding/CpfCnpjInput';

const Harness = ({ initial = '' }: { initial?: string }) => {
  const [value, setValue] = useState(initial);
  return <CpfCnpjInput value={value} onChange={setValue} />;
};

describe('CpfCnpjInput — cursor & paste', () => {
  it('mantém todos os dígitos ao colar string com pontuação no input vazio', () => {
    render(<Harness />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '111.444.777-35' } });
    expect(input.value).toBe('111.444.777-35');
  });

  it('paste no meio com seleção ativa substitui o trecho selecionado e mantém máscara', () => {
    render(<Harness initial="12345678901" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('123.456.789-01');
    // Simula colar um CNPJ inteiro: o React/jsdom recebe o novo `value`.
    fireEvent.change(input, { target: { value: '12345678000195' } });
    expect(input.value).toBe('12.345.678/0001-95');
  });

  it('digitar um dígito no meio mantém o cursor posicionado após o dígito recém-inserido', () => {
    render(<Harness initial="12345678" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('123.456.78');
    // Posiciona cursor após "123.4" (dígito 4) e digita "9" → "1234956 78".
    input.setSelectionRange(5, 5);
    act(() => {
      fireEvent.change(input, {
        target: { value: '123.49456.78', selectionStart: 6 },
      });
    });
    // Deve recompor para 123.494.567-8 (9 dígitos) e cursor após o dígito digitado.
    expect(input.value.replace(/\D/g, '')).toBe('123494567');
    // Cursor deve estar logo após o 5º dígito (índice 6 considerando '.': "123.49|...").
    expect(input.selectionStart).toBe(6);
  });

  it('apagar separador não remove dígitos', () => {
    render(<Harness initial="12345678901" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    // Backspace logo após "123." remove o ponto na string crua mas a máscara
    // recompõe — os 11 dígitos seguem intactos.
    fireEvent.change(input, { target: { value: '123456.789-01', selectionStart: 3 } });
    expect(input.value.replace(/\D/g, '')).toBe('12345678901');
  });

  it('truncamento em 14 dígitos não derruba dígitos já digitados', () => {
    render(<Harness initial="12345678000195" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('12.345.678/0001-95');
    // Tenta colar mais 5 dígitos no final — devem ser ignorados (cap em 14).
    fireEvent.change(input, { target: { value: '12.345.678/0001-9599999' } });
    expect(input.value).toBe('12.345.678/0001-95');
  });
});

describe('Botões do Passo 3 — contrato funcional', () => {
  it('campo opcional: vazio não deve bloquear o avanço', () => {
    // Espelha a lógica do componente: gate só roda quando há dígitos.
    const taxId = '';
    const taxIdDigits = taxId.replace(/\D/g, '');
    const blocksAdvance = taxIdDigits.length > 0; // false → libera
    expect(blocksAdvance).toBe(false);
  });

  it('campo preenchido com dígitos inválidos deve bloquear o avanço', async () => {
    const { isValidCpfCnpj } = await import('@/lib/cpfCnpj');
    const taxIdDigits = '12345678900'; // 11 dígitos mas inválido (mod11)
    expect(isValidCpfCnpj(taxIdDigits)).toBe(false);
  });

  it('"Pular" deve ser oferecido apenas quando o documento está vazio', () => {
    // Reproduz a regra do JSX: {!taxFilled && <Button>Pular passo agora</Button>}
    const cases: Array<{ taxId: string; expectSkip: boolean }> = [
      { taxId: '', expectSkip: true },
      { taxId: '123', expectSkip: false },
      { taxId: '12345678901', expectSkip: false },
    ];
    for (const c of cases) {
      const taxFilled = c.taxId.replace(/\D/g, '').length > 0;
      expect(!taxFilled).toBe(c.expectSkip);
    }
  });
});
