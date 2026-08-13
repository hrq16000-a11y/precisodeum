import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton do sistema.
 *
 * Motion: varredura (shimmer) contínua em vez de pulse piscante — leitura mais
 * suave e menor sensação de espera. `prefers-reduced-motion` desliga a animação
 * (regra em index.css) mantendo o bloco visível.
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn("skeleton-shimmer rounded-md bg-muted", className)}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
