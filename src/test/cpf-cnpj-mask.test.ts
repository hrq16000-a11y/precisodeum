import { describe, it, expect } from 'vitest';
import { maskCpfCnpj } from '@/components/onboarding/CpfCnpjInput';
import { isValidCpfCnpj } from '@/lib/cpfCnpj';

describe('maskCpfCnpj', () => {
  it('formata CPF parcial e completo', () => {
    expect(maskCpfCnpj('1')).toBe('1');
    expect(maskCpfCnpj('123')).toBe('123');
    expect(maskCpfCnpj('123456')).toBe('123.456');
    expect(maskCpfCnpj('12345678901')).toBe('123.456.789-01');
  });

  it('formata CNPJ ao passar 12+ dígitos', () => {
    expect(maskCpfCnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('aceita string colada com pontos/barras e devolve máscara limpa', () => {
    expect(maskCpfCnpj('123.456.789-01')).toBe('123.456.789-01');
    expect(maskCpfCnpj('12.345.678/0001-95')).toBe('12.345.678/0001-95');
  });

  it('trunca em 14 dígitos (CNPJ) sem quebrar', () => {
    expect(maskCpfCnpj('123456780001959999')).toBe('12.345.678/0001-95');
  });

  it('lida com entrada vazia ou só símbolos', () => {
    expect(maskCpfCnpj('')).toBe('');
    expect(maskCpfCnpj('....---///')).toBe('');
  });
});

describe('isValidCpfCnpj — gate do Passo 3 do wizard', () => {
  it('valida CPFs reais e rejeita lixo', () => {
    expect(isValidCpfCnpj('111.444.777-35')).toBe(true);
    expect(isValidCpfCnpj('11111111111')).toBe(false);
    expect(isValidCpfCnpj('123')).toBe(false);
  });

  it('valida CNPJs reais e rejeita lixo', () => {
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCpfCnpj('00000000000000')).toBe(false);
  });

  it('campo opcional: vazio retorna false (gate só roda quando há dígitos)', () => {
    // O wizard só chama isValidCpfCnpj quando há dígitos preenchidos —
    // string vazia é considerada "pular" e libera o avanço.
    expect(isValidCpfCnpj('')).toBe(false);
    expect(''.replace(/\D/g, '').length === 0).toBe(true);
  });
});
