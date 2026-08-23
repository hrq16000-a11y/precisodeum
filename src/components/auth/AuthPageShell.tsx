import type { ReactNode } from 'react';
import { Link } from '@/lib/router-compat';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import Logo from '@/components/Logo';

interface AuthPageShellProps {
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
  showHelpLink?: boolean;
}

const AuthPageShell = ({
  children,
  backTo,
  backLabel = 'Voltar',
  showHelpLink = true,
}: AuthPageShellProps) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Logo priority sizes="(max-width: 639px) 180px, 190px" className="h-14 sm:h-14" />

          <div className="flex items-center gap-2 text-sm">
            {backTo ? (
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : null}

            {showHelpLink ? (
              <Link
                to="/ajuda"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Ajuda</span>
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-lg items-center justify-center px-4 py-8 sm:py-10">
        {children}
      </main>
    </div>
  );
};

export default AuthPageShell;