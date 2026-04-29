import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/errorReporter';
import { AlertTriangle, MessageCircle, Camera, Copy, Check } from 'lucide-react';

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
  copied: boolean;
}

/**
 * ErrorGuard — User-friendly error boundary with automatic reporting.
 * Shows recovery options and captures full context.
 */
class ErrorGuard extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reportId: null, reporting: false, copied: false };
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


  private handleCopy = async () => {
    const id = this.state.reportId || '';
    const summary = `Erro: ${this.state.error?.message || 'desconhecido'}\nCódigo: ${id}\nRota: ${typeof window !== 'undefined' ? window.location.pathname : ''}`;
    try {
      await navigator.clipboard.writeText(summary);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* noop */
    }
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, reportId: null, copied: false });
  };

  render() {
    if (this.state.hasError) {
      const code = this.state.reportId ? this.state.reportId.slice(0, 8) : null;
      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-7 shadow-lg space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Algo deu errado</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Encontramos um problema inesperado. Você pode tentar novamente
                  ou enviar um print para o suporte para resolvermos rapidamente.
                </p>
              </div>
            </div>

            {code && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Código do erro</span>
                  <span className="font-mono font-bold text-foreground">{code}</span>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-800 dark:text-amber-300">
              <p className="flex items-start gap-2 font-semibold">
                <Camera className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Tire um print desta tela e envie ao suporte</span>
              </p>
              <p className="mt-1 ml-6 opacity-90">
                Inclua o código de erro acima — assim conseguimos identificar o problema na hora.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Tentar novamente
              </button>
              <a
                href="/ajuda"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <MessageCircle className="h-4 w-4" /> Falar com suporte
              </a>
            </div>

            {code && (
              <button
                type="button"
                onClick={this.handleCopy}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                {this.state.copied ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado!</> : <><Copy className="h-3.5 w-3.5" /> Copiar código + detalhes</>}
              </button>
            )}

            {this.state.reporting && (
              <p className="text-center text-[11px] text-muted-foreground">Registrando relatório técnico...</p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorGuard;
