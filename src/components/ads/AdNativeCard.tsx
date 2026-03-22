import { useSponsorsByPosition } from '@/components/SponsorAd';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone } from 'lucide-react';
import SponsorImage from '@/components/SponsorImage';

interface AdNativeCardProps {
  sponsorIndex?: number;
  className?: string;
}

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
      className={`group min-w-0 overflow-hidden rounded-xl border border-accent/20 bg-accent/5 p-4 shadow-card transition-all hover:shadow-lg hover:border-accent/40 ${className}`}
    >
      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
        <Megaphone className="h-3 w-3" /> Patrocinado
      </span>
      {sponsor.image_url && (
        <SponsorImage
          src={sponsor.image_url}
          alt={sponsor.title}
          containerClassName="mb-3 rounded-lg"
        />
      )}
      <h3 className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
        {sponsor.title}
      </h3>
    </a>
  );
};

export default AdNativeCard;
