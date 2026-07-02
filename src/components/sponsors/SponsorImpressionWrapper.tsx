import { ReactNode } from 'react';
import { useSponsorImpression } from '@/hooks/useSponsorImpression';

interface Props {
  sponsorId: string;
  slot: string;
  trackImpression: (id: string) => void;
  className?: string;
  children: ReactNode;
}

/**
 * Wrapper invisível que dispara impressão de sponsor APENAS quando o elemento
 * fica visível (IntersectionObserver), com deduplicação por sessão.
 *
 * Não altera layout — apenas anexa um ref no container interno.
 */
export default function SponsorImpressionWrapper({
  sponsorId,
  slot,
  trackImpression,
  className,
  children,
}: Props) {
  const ref = useSponsorImpression(sponsorId, slot, trackImpression);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
