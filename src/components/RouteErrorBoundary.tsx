import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { reportError } from "@/lib/errorReporter";

/**
 * RouteErrorBoundary — granular error boundary for individual routes/sections.
 *
 * Goal: isolate render failures inside a single route so that the global shell
 * (header, footer, admin sidebar, etc.) keeps working. Prevents the
 * "white screen of death" that would otherwise bubble up to the top-level ErrorGuard.
 *
 * Behavior:
 *  - Catches render errors of children and shows a contained fallback card.
 *  - Re-throws chunk-load errors so LazyRouteBoundary handles them (redirect to /error/500).
 *  - Resets automatically when the route changes (pathname-based key on the wrapper).
 *  - Offers "Tentar novamente" (local reset) and "Voltar ao início".
 */

interface Props {
  children: ReactNode;
  /** Short, human-friendly section name used for telemetry/log. */
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const DYNAMIC_IMPORT_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "dynamically imported module",
];

const isDynamicImportError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = (error.message || "").toLowerCase();
  const name = (error.name || "").toLowerCase();
  if (name === "chunkloaderror") return true;
  return DYNAMIC_IMPORT_PATTERNS.some((p) => message.includes(p));
};

class RouteErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    if (isDynamicImportError(error)) {
      // Let LazyRouteBoundary handle chunk failures
      throw error;
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const section = this.props.sectionName || "RouteErrorBoundary";
    console.error(`[RouteErrorBoundary:${section}]`, error, info?.componentStack);
    void reportError({
      errorMessage: error.message,
      errorStack: (error.stack || "") + "\n\nComponent Stack:" + (info?.componentStack || ""),
      componentName: section,
      actionContext: `Erro de renderização em ${section}`,
      severity: "error",
    }).catch(() => undefined);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mx-auto my-8 max-w-xl rounded-lg border border-border bg-card p-6 shadow-xs"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-destructive" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              Algo deu errado nesta área
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O restante do site continua funcionando. Você pode tentar recarregar
              esta seção ou voltar para a página inicial.
            </p>
            {this.state.error?.message ? (
              <pre className="mt-3 max-h-32 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Voltar ao início
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Public wrapper — uses pathname as React key so navigating to a new
 * route automatically resets the boundary state (fresh mount).
 */
const RouteErrorBoundary = ({ children, sectionName }: Props) => {
  const location = useLocation();
  return (
    <RouteErrorBoundaryInner key={location.pathname} sectionName={sectionName}>
      {children}
    </RouteErrorBoundaryInner>
  );
};

export default RouteErrorBoundary;
