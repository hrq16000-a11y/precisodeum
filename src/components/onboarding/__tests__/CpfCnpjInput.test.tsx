import { describe, it, expect } from 'vitest';
import { maskCpfCnpj } from '../CpfCnpjInput';
import { isValidCpf, isValidCnpj, isValidCpfCnpj } from '@/lib/cpfCnpj';

describe('maskCpfCnpj', () => {
  it('aplica máscara de CPF (modo auto, ≤ 11 dígitos)', () => {
    expect(maskCpfCnpj('12345678909')).toBe('123.456.789-09');
  });

  it('aplica máscara de CNPJ (modo auto, > 11 dígitos)', () => {
    expect(maskCpfCnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('modo cpf trunca em 11 dígitos mesmo com input maior', () => {
    expect(maskCpfCnpj('12345678909999', 'cpf')).toBe('123.456.789-09');
  });

  it('modo cnpj sempre formata como CNPJ', () => {
    expect(maskCpfCnpj('12345678', 'cnpj')).toBe('12.345.678');
    expect(maskCpfCnpj('12345678000195', 'cnpj')).toBe('12.345.678/0001-95');
  });

  it('remove caracteres não-numéricos automaticamente', () => {
    expect(maskCpfCnpj('abc123.456-789xx09', 'cpf')).toBe('123.456.789-09');
  });

  it('lida com string vazia sem quebrar', () => {
    expect(maskCpfCnpj('')).toBe('');
  });
});

describe('isValidCpfCnpj', () => {
  it('aceita CPF válido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpfCnpj('52998224725')).toBe(true);
  });

  it('rejeita CPF com todos dígitos iguais', () => {
    expect(isValidCpf('11111111111')).toBe(false);
  });

  it('rejeita CPF inválido (dígitos verificadores errados)', () => {
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('aceita CNPJ válido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCpfCnpj('11222333000181')).toBe(true);
  });

  it('rejeita CNPJ inválido', () => {
    expect(isValidCnpj('11222333000180')).toBe(false);
  });

  it('rejeita strings de tamanho errado (não é nem CPF nem CNPJ)', () => {
    expect(isValidCpfCnpj('123')).toBe(false);
    expect(isValidCpfCnpj('123456789012')).toBe(false); // 12 dígitos
  });
});
