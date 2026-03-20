import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone } from 'lucide-react';

interface AdNativeCardProps {
  /** Index in the sponsor list to show (for distributing across listings) */
  sponsorIndex?: number;
  className?: string;
}

/** A native ad card that looks like a regular listing card but with "Patrocinado" badge */
const AdNativeCard = ({ sponsorIndex = 0, className = '' }: AdNativeCardProps) => {
  const { data: sponsors = [] } = useSponsorsByPosition('native');
  const tracked = useRef(new Set<string>());

  const sponsor = sponsors[sponsorIndex % sponsors.length];

  useEffect(() => {
    if (sponsor && !tracked.current.has(sponsor.id)) {
      tracked.current.add(sponsor.id);
      supabase.rpc('increment_sponsor_impression', { sponsor_id: sponsor.id } as any).then(() => {});
    }
  }, [sponsor]);

  if (!sponsor) return null;

  return (
    <a
      href={sponsor.link_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        supabase.rpc('increment_sponsor_click', { sponsor_id: sponsor.id } as any).then(() => {});
      }}
      className={`group relative rounded-xl border border-accent/20 bg-accent/5 p-4 shadow-card transition-all hover:shadow-lg hover:border-accent/40 ${className}`}
    >
      <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
        <Megaphone className="h-3 w-3" /> Patrocinado
      </span>
      {sponsor.image_url && (
        <img
          src={sponsor.image_url}
          alt={sponsor.title}
          className="mb-3 h-28 w-full rounded-lg object-cover"
          loading="lazy"
        />
      )}
      <h3 className="mt-1 font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 pr-20">
        {sponsor.title}
      </h3>
    </a>
  );
};

export default AdNativeCard;
