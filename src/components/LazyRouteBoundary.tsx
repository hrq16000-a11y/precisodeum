import { Component, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface Props {
  children: ReactNode;
}

interface State {
  shouldRedirect: boolean;
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

/**
 * LazyRouteBoundary — catches chunk-load failures from React.lazy routes
 * AFTER lazyWithRetry has exhausted its retries, and redirects to /error/500.
 * Does not handle generic runtime errors (those go to ErrorGuard).
 */
class LazyRouteBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { shouldRedirect: false };
  }

  static getDerivedStateFromError(error: Error): State | null {
    if (isDynamicImportError(error)) {
      return { shouldRedirect: true };
    }
    // Re-throw to outer ErrorGuard for non-chunk errors
    throw error;
  }

  componentDidCatch(error: Error) {
    if (isDynamicImportError(error)) {
      console.error("[LazyRouteBoundary] Dynamic import failed, redirecting to /error/500", error);
    }
  }

  render() {
    if (this.state.shouldRedirect) {
      return <Navigate to="/error/500" replace />;
    }
    return this.props.children;
  }
}

export default LazyRouteBoundary;
