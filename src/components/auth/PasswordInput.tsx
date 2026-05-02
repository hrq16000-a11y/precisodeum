/**
 * PasswordInput — input de senha com toggle mostrar/ocultar e (opcional)
 * lista de regras dinâmicas. Usa apenas tokens semânticos (sem cores cruas).
 */
import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const DEFAULT_PASSWORD_RULES: PasswordRule[] = [
  { id: 'len', label: 'Mínimo 6 caracteres', test: (v) => v.length >= 6 },
  { id: 'letter', label: 'Pelo menos 1 letra', test: (v) => /[A-Za-zÀ-ÿ]/.test(v) },
  { id: 'number', label: 'Pelo menos 1 número', test: (v) => /\d/.test(v) },
];

export const STRONG_PASSWORD_RULES: PasswordRule[] = [
  { id: 'len', label: 'Mínimo 8 caracteres', test: (v) => v.length >= 8 },
  { id: 'upper', label: '1 letra maiúscula', test: (v) => /[A-ZÀ-Þ]/.test(v) },
  { id: 'lower', label: '1 letra minúscula', test: (v) => /[a-zß-ÿ]/.test(v) },
  { id: 'number', label: '1 número', test: (v) => /\d/.test(v) },
];

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Quando true, exibe a lista de regras abaixo do campo. */
  showRules?: boolean;
  /** Conjunto de regras para checagem visual (default: DEFAULT_PASSWORD_RULES). */
  rules?: PasswordRule[];
  /** Label opcional do botão olho para acessibilidade (pt-BR default). */
  showLabel?: string;
  hideLabel?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  {
    showRules = false,
    rules = DEFAULT_PASSWORD_RULES,
    className = '',
    showLabel = 'Mostrar senha',
    hideLabel = 'Ocultar senha',
    value = '',
    ...rest
  },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const rulesId = useId();
  const fromValue = typeof value === 'string' ? value : value != null ? String(value) : '';
  const fromDefault = typeof rest.defaultValue === 'string' ? rest.defaultValue : '';
  const v = value !== undefined ? fromValue : fromDefault;

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={ref}
          {...rest}
          {...(value !== undefined ? { value } : {})}
          type={visible ? 'text' : 'password'}
          aria-describedby={showRules ? rulesId : undefined}
          className={
            'w-full rounded-md border border-input bg-background px-3 py-2 pr-11 text-sm text-foreground ' +
            'focus:outline-none focus:ring-2 focus:ring-ring ' +
            className
          }
        />
        <button
          type="button"
          onClick={() => setVisible((s) => !s)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          tabIndex={0}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-md"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {showRules && (
        <ul id={rulesId} className="space-y-1 text-xs" aria-live="polite">
          {rules.map((rule) => {
            const ok = rule.test(v);
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
              >
                {ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                )}
                <span>{rule.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

export default PasswordInput;
