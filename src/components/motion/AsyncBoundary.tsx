import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AsyncBoundaryProps {
  loading?: boolean;
  error?: unknown;
  /** true quando a consulta retornou vazio (sem erro). */
  empty?: boolean;
  /** Skeleton específico da tela. Obrigatório para não existir tela em branco. */
  skeleton: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  className?: string;
  children: ReactNode;
}

/** Detecta erro de permissão do backend (42501 / RLS) para mensagem correta. */
const isPermissionError = (error: unknown): boolean => {
  const e = error as { code?: string; message?: string } | null;
  const msg = `${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return msg.includes('42501') || msg.includes('permission denied') || msg.includes('row-level security');
};

/**
 * Contrato único de estados assíncronos: carregando → erro → vazio → conteúdo.
 * Garante que nenhuma tela fique em branco e que a transição entre estados
 * seja suave (fade curto), respeitando `prefers-reduced-motion`.
 */
const AsyncBoundary = ({
  loading,
  error,
  empty,
  skeleton,
  emptyTitle = 'Nada por aqui ainda',
  emptyDescription = 'Quando houver dados, eles aparecem nesta tela.',
  emptyAction,
  onRetry,
  className,
  children,
}: AsyncBoundaryProps) => {
  if (loading) {
    return <div className={cn('motion-enter-fade', className)}>{skeleton}</div>;
  }

  if (error) {
    const denied = isPermissionError(error);
    return (
      <div
        role="alert"
        className={cn(
          'motion-enter flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-8 text-center',
          className,
        )}
      >
        {denied ? (
          <Lock className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        )}
        <p className="font-medium text-foreground">
          {denied ? 'Você não tem permissão para ver estes dados' : 'Não conseguimos carregar estes dados'}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {denied
            ? 'Se acredita que deveria ter acesso, entre com a conta correta ou fale com o suporte.'
            : 'Verifique sua conexão e tente novamente em alguns segundos.'}
        </p>
        {!denied && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={cn(
          'motion-enter flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center',
          className,
        )}
      >
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">{emptyTitle}</p>
        <p className="max-w-md text-sm text-muted-foreground">{emptyDescription}</p>
        {emptyAction}
      </div>
    );
  }

  return <div className={cn('motion-enter-fade', className)}>{children}</div>;
};

export default AsyncBoundary;
export { AsyncBoundary, isPermissionError };
