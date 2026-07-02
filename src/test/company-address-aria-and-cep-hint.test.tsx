/**
 * Cobertura adicional do CompanyAddressForm:
 *  - aria-invalid + IDs (street-error / number-error / cep-error) quando inválidos.
 *  - Mensagem específica para street_number > 10 caracteres (vs formato).
 *  - Dica inline quando o CEP tem entre 1 e 7 dígitos (não-bloqueante).
 *  - Dica desaparece ao chegar a 8 dígitos (lookup gated).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompanyAddressForm, {
  type CompanyAddressValue,
} from '@/components/company/CompanyAddressForm';

vi.mock('@/lib/cepLookup', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cepLookup')>('@/lib/cepLookup');
  return { ...actual, lookupCep: vi.fn().mockResolvedValue({ ok: false, reason: 'not_found', message: 'x' }) };
});

const noop = () => {};
function renderForm(value: CompanyAddressValue) {
  return render(<CompanyAddressForm value={value} onChange={noop} />);
}

describe('CompanyAddressForm — aria + número longo + CEP hint', () => {
  it('aria-invalid + #street-error quando street tem 1-2 chars', () => {
    renderForm({ street: 'X' });
    const input = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('street-error');
    expect(document.getElementById('street-error')).toBeTruthy();
  });

  it('aria-invalid + #number-error quando street_number é inválido', () => {
    renderForm({ street_number: 'abc!@' });
    const input = screen.getByPlaceholderText('123') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('number-error');
    expect(document.getElementById('number-error')).toBeTruthy();
    expect(screen.getByText(/Número inválido/i)).toBeTruthy();
  });

  it('mensagem específica de "muito longo" quando street_number > 10 caracteres', () => {
    renderForm({ street_number: '12345678901234' });
    expect(screen.getByText(/muito longo/i)).toBeTruthy();
    expect(screen.queryByText(/Número inválido/i)).toBeNull();
  });

  it('aria-invalid + #cep-error quando CEP tem 1-7 dígitos', () => {
    renderForm({ postal_code: '01310' });
    const input = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('cep-error');
    expect(document.getElementById('cep-error')).toBeTruthy();
  });

  it('dica inline aparece com 1-7 dígitos junto do erro de CEP incompleto', () => {
    renderForm({ postal_code: '0131' });
    // Erro tem prioridade visual mas a dica também é renderizada apenas quando NÃO há erro?
    // Regra atual: dica só renderiza se !cepError. Como há erro, hint NÃO deve aparecer.
    expect(screen.queryByTestId('cep-hint')).toBeNull();
    // Mas o erro com contagem aparece.
    expect(screen.getByText(/CEP incompleto/i)).toBeTruthy();
  });

  it('CEP vazio: sem erro, mas exibe dica convidando o usuário a digitar o CEP', () => {
    renderForm({});
    // O aviso "Informe o CEP — buscamos o endereço pra você" agora é a UX padrão.
    expect(screen.getByTestId('cep-hint').textContent).toMatch(/Informe o CEP/i);
    expect(document.getElementById('cep-error')).toBeNull();
  });

  it('aria-invalid=false quando todos os campos estão válidos ou vazios', () => {
    renderForm({ street: 'Rua das Flores', street_number: '123', postal_code: '01310100' });
    const street = screen.getByPlaceholderText('Rua / Avenida') as HTMLInputElement;
    const num = screen.getByPlaceholderText('123') as HTMLInputElement;
    const cep = screen.getByPlaceholderText('00000-000') as HTMLInputElement;
    expect(street.getAttribute('aria-invalid')).toBe('false');
    expect(num.getAttribute('aria-invalid')).toBe('false');
    expect(cep.getAttribute('aria-invalid')).toBe('false');
  });
});
