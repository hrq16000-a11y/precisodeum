import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  /** 0–100. Quando omitido, renderiza barra indeterminada. */
  value?: number;
  label?: string;
  /** Fixa no topo da viewport (uso global de navegação/carregamento). */
  fixed?: boolean;
  className?: string;
}

/**
 * Barra de progresso única do sistema: determinada (com valor) ou
 * indeterminada (carregamento sem previsão). Sempre acessível.
 */
const ProgressIndicator = ({ value, label = 'Carregando', fixed, className }: ProgressIndicatorProps) => {
  const determinate = typeof value === 'number';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(Math.min(100, Math.max(0, value!))) : undefined}
      className={cn(
        'h-1 w-full overflow-hidden rounded-full bg-muted',
        fixed && 'fixed left-0 right-0 top-0 z-[9999] rounded-none bg-transparent',
        className,
      )}
    >
      {determinate ? (
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value!))}%` }}
        />
      ) : (
        <div className="motion-indeterminate h-full w-1/3 rounded-full bg-primary/70" />
      )}
    </div>
  );
};

export default ProgressIndicator;
export { ProgressIndicator };
