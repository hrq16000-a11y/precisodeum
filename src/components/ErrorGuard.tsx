import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/errorReporter';
import { AlertTriangle, MessageCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  componentName: string;
  fallbackRoute?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reportId: string | null;
  reporting: boolean;
}

/**
 * ErrorGuard — User-friendly error boundary with automatic reporting.
 * Shows recovery options and captures full context.
 */
class ErrorGuard extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reportId: null, reporting: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorGuard:${this.props.componentName}]`, error, info.componentStack);
    
    this.setState({ reporting: true });
    const reportId = await reportError({
      errorMessage: error.message,
      errorStack: (error.stack || '') + '\n\nComponent Stack:' + (info.componentStack || ''),
      componentName: this.props.componentName,
      actionContext: `Erro no componente ${this.props.componentName}`,
      severity: 'critical',
    });
    this.setState({ reportId, reporting: false });
  }


  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-8 shadow-lg text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            
            <h2 className="text-lg font-bold text-foreground">
              Algo deu errado
            </h2>
            
            <p className="text-sm text-muted-foreground">
              Encontramos um problema inesperado. Nossa equipe já foi notificada e está trabalhando na correção.
            </p>

            {this.state.reportId && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>Código do erro: <span className="font-mono font-bold text-foreground">{this.state.reportId.slice(0, 8)}</span></p>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-left text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Suporte disponível:</p>
              <p>• Nossa equipe já recebeu o relatório técnico</p>
              <p>• Se precisar, acione a Central de Ajuda abaixo</p>
            </div>

            <a
              href="/ajuda"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-accent/10 px-4 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Acionar suporte
            </a>

            <p className="text-[11px] text-muted-foreground pt-2">
              Se precisar falar com o suporte, informe o código acima.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorGuard;
