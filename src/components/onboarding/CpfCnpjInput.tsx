import { ChangeEvent, forwardRef, useLayoutEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

export type CpfCnpjMode = 'auto' | 'cpf' | 'cnpj';

/** Aplica máscara de CPF (000.000.000-00). */
const maskCpf = (raw: string): string => {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

/** Aplica máscara de CNPJ (00.000.000/0000-00). */
const maskCnpj = (raw: string): string => {
  const d = (raw || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

/** Aplica máscara dinâmica de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00). */
export const maskCpfCnpj = (raw: string, mode: CpfCnpjMode = 'auto'): string => {
  if (mode === 'cpf') return maskCpf(raw);
  if (mode === 'cnpj') return maskCnpj(raw);
  const d = (raw || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) return maskCpf(d);
  return maskCnpj(d);
};

/** Conta quantos dígitos existem nos primeiros `limit` caracteres da string mascarada. */
const countDigits = (str: string, limit: number) => {
  let n = 0;
  for (let i = 0; i < Math.min(limit, str.length); i++) {
    if (/\d/.test(str[i])) n++;
  }
  return n;
};

/** Devolve o índice no qual o cursor deve parar para manter `n` dígitos à esquerda. */
const indexAfterDigits = (masked: string, n: number) => {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < masked.length; i++) {
    if (/\d/.test(masked[i])) {
      count++;
      if (count === n) return i + 1;
    }
  }
  return masked.length;
};

interface CpfCnpjInputProps {
  /** Valor cru (apenas dígitos). */
  value: string;
  /** Recebe APENAS dígitos (sem máscara). */
  onChange: (digitsOnly: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean;
  id?: string;
  name?: string;
}

/**
 * Input de CPF/CNPJ com máscara aplicada visualmente, mantendo a posição
 * do cursor estável quando o usuário digita ou cola números no meio do campo.
 *
 * - Aceita colar valores com pontos/traços ou só números.
 * - Trunca em 14 dígitos (CNPJ).
 * - Sempre devolve apenas dígitos para o caller via onChange.
 */
const CpfCnpjInput = forwardRef<HTMLInputElement, CpfCnpjInputProps>(({
  value,
  onChange,
  onBlur,
  placeholder = 'Ex: 000.000.000-00 ou 00.000.000/0000-00',
  className,
  id,
  name,
  ...rest
}, ref) => {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const desiredCursorRef = useRef<number | null>(null);
  const setRef = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as any).current = node;
  };

  const masked = maskCpfCnpj(value || '');

  useLayoutEffect(() => {
    const el = innerRef.current;
    const desired = desiredCursorRef.current;
    if (el && desired !== null) {
      el.setSelectionRange(desired, desired);
      desiredCursorRef.current = null;
    }
  }, [masked]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const cursorBefore = el.selectionStart ?? raw.length;
    // Conta quantos dígitos existem ATÉ a posição do cursor — esse número é estável
    // mesmo quando a máscara reorganiza pontos/barras ao redor.
    const digitsBeforeCursor = countDigits(raw, cursorBefore);
    const onlyDigits = raw.replace(/\D/g, '').slice(0, 14);
    const newMasked = maskCpfCnpj(onlyDigits);
    desiredCursorRef.current = indexAfterDigits(newMasked, digitsBeforeCursor);
    onChange(onlyDigits);
  };

  return (
    <Input
      ref={setRef}
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={masked}
      onChange={handleChange}
      onBlur={onBlur}
      className={className}
      {...rest}
    />
  );
});

CpfCnpjInput.displayName = 'CpfCnpjInput';

export default CpfCnpjInput;
