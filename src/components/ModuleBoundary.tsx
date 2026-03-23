import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  moduleName: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary isolado para módulos novos (CRM/CMS).
 * Se um módulo novo falhar, a plataforma principal continua funcionando.
 */
class ModuleBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ModuleBoundary:${this.props.moduleName}] Erro isolado:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-destructive">
              Módulo "{this.props.moduleName}" encontrou um erro.
            </p>
            <p className="text-xs text-muted-foreground">
              A plataforma principal continua funcionando normalmente.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ModuleBoundary;
