/**
 * BetCardShell — wrapper visual padrão do wizard unificado.
 *
 * Garante que TODA tela do onboarding (triagem, fases V2, extras 20/21 e
 * tela Done) compartilhe o mesmo "card bet": cantos arredondados de 28px,
 * gradiente sutil amber, borda translúcida e sombra elevada.
 *
 * Use sempre que renderizar uma tela do wizard fora dos orquestradores
 * Triage/Main que já trazem seu próprio card embutido.
 */
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BetCardShellProps {
  children: React.ReactNode;
  className?: string;
  /** Renderiza com motion (entrada suave). Default: true. */
  animated?: boolean;
}

export default function BetCardShell({ children, className, animated = true }: BetCardShellProps) {
  const Wrapper: any = animated ? motion.div : 'div';
  const motionProps = animated
    ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } }
    : {};
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <Wrapper
        {...motionProps}
        className={cn(
          'rounded-[28px] border border-border/60 bg-gradient-to-b from-card/95 via-background to-amber-50/20 p-5 shadow-[0_24px_80px_-36px_hsl(var(--foreground)/0.3)] dark:to-amber-950/10',
          className,
        )}
      >
        {children}
      </Wrapper>
    </div>
  );
}
