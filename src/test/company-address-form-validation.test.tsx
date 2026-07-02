/**
 * Validação inline do CompanyAddressForm:
 *  - Logradouro com 1-2 caracteres exibe mensagem de erro.
 *  - Número com caracteres inválidos (não-dígitos, não-S/N) exibe erro;
 *    "S/N" é aceito sem erro.
 *  - CEP incompleto (1-7 dígitos) exibe erro; 8 dígitos não exibe.
 *  - Mensagens de erro NÃO aparecem com campos vazios (regra não-bloqueante).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompanyAddressForm, {
  type CompanyAddressValue,
} from '@/components/company/CompanyAddressForm';

const noop = () => {};

function renderForm(value: CompanyAddressValue) {
  return render(<CompanyAddressForm value={value} onChange={noop} />);
}

describe('CompanyAddressForm — validação inline (não-bloqueante)', () => {
  it('vazio: nenhuma mensagem de erro aparece', () => {
    renderForm({});
    expect(screen.queryByText(/Logradouro muito curto/i)).toBeNull();
    expect(screen.queryByText(/Número inválido/i)).toBeNull();
    expect(screen.queryByText(/CEP incompleto/i)).toBeNull();
  });

  it('logradouro com 2 caracteres: mostra erro de tamanho mínimo', () => {
    renderForm({ street: 'Ru' });
    expect(screen.getByText(/Logradouro muito curto/i)).toBeTruthy();
  });

  it('logradouro com 3+ caracteres: sem erro', () => {
    renderForm({ street: 'Rua' });
    expect(screen.queryByText(/Logradouro muito curto/i)).toBeNull();
  });

  it('número com caracteres inválidos exibe erro; "S/N" é aceito', () => {
    const { rerender } = renderForm({ street_number: 'abc!@' });
    expect(screen.getByText(/Número inválido/i)).toBeTruthy();
    rerender(<CompanyAddressForm value={{ street_number: 'S/N' }} onChange={noop} />);
    expect(screen.queryByText(/Número inválido/i)).toBeNull();
    rerender(<CompanyAddressForm value={{ street_number: '123' }} onChange={noop} />);
    expect(screen.queryByText(/Número inválido/i)).toBeNull();
  });

  it('CEP incompleto (5 dígitos) exibe erro; 8 dígitos não', () => {
    const { rerender } = renderForm({ postal_code: '01310' });
    expect(screen.getByText(/CEP incompleto/i)).toBeTruthy();
    rerender(<CompanyAddressForm value={{ postal_code: '01310100' }} onChange={noop} />);
    expect(screen.queryByText(/CEP incompleto/i)).toBeNull();
  });

  it('aria-invalid=true é aplicado em campos com erro', () => {
    renderForm({ street: 'X', postal_code: '123' });
    const streetInput = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    const cepInput = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    expect(streetInput.getAttribute('aria-invalid')).toBe('true');
    expect(cepInput.getAttribute('aria-invalid')).toBe('true');
  });
});
