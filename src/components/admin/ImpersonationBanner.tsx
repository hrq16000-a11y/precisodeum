import { Eye, LogOut } from 'lucide-react';
import { useImpersonation } from '@/hooks/useImpersonation';
import { Button } from '@/components/ui/button';

const ImpersonationBanner = () => {
  const { impersonation, isImpersonating, stop } = useImpersonation();
  if (!isImpersonating || !impersonation) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] w-full bg-destructive text-destructive-foreground shadow-md"
    >
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">
            Você está vendo o sistema como{' '}
            <strong className="font-semibold">
              {impersonation.targetName ?? impersonation.targetEmail}
            </strong>
            . Toda ação está sendo auditada.
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={stop}
          className="shrink-0 gap-1.5"
        >
          <LogOut className="h-4 w-4" />
          Sair do modo
        </Button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
