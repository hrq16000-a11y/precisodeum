import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef, useMemo, useState } from 'react';
import SponsorImage from '@/components/SponsorImage';

interface SlotSponsor {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  tier: string;
  priority: number;
}

interface AdSlotProps {
  slotSlug: string;
  className?: string;
  layout?: 'banner' | 'sidebar' | 'inline' | 'native';
  /** Page context for targeting */
  category?: string;
  city?: string;
  state?: string;
  maxAds?: number;
}

function useSlotSponsors(slotSlug: string, category?: string, city?: string, state?: string) {
  return useQuery({
    queryKey: ['ad-slot', slotSlug, category, city, state],
    queryFn: async () => {
      // Get slot
      const { data: slot } = await supabase
        .from('ad_slots' as any)
        .select('id, max_ads, active')
        .eq('slug', slotSlug)
        .single();

      if (!slot || !(slot as any).active) return [];

      // Get assignments
      const now = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('ad_slot_assignments' as any)
        .select('sponsor_id, priority, target_category, target_city, target_state')
        .eq('slot_id', (slot as any).id)
        .eq('active', true);

      const { data: assignments } = await query;
      if (!assignments || assignments.length === 0) return [];

      // Filter by date and targeting
      const validAssignments = (assignments as any[]).filter(a => {
        if (a.target_category && category && a.target_category !== category) return false;
        if (a.target_city && city && a.target_city !== city) return false;
        if (a.target_state && state && a.target_state !== state) return false;
        return true;
      });

      if (validAssignments.length === 0) return [];

      const sponsorIds = validAssignments.map(a => a.sponsor_id);
      const { data: sponsors } = await supabase
        .from('sponsors')
        .select('id, title, image_url, link_url, tier')
        .in('id', sponsorIds)
        .eq('active', true);

      if (!sponsors) return [];

      // Filter by date validity
      const priorityMap = new Map(validAssignments.map(a => [a.sponsor_id, a.priority || 0]));
      
      return (sponsors as any[])
        .map(s => ({ ...s, priority: priorityMap.get(s.id) || 0 }))
        .sort((a, b) => b.priority - a.priority)
        .slice(0, (slot as any).max_ads) as SlotSponsor[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

function trackMetric(sponsorId: string, slotSlug: string, eventType: 'impression' | 'click') {
  supabase.rpc('track_sponsor_metric', {
    _sponsor_id: sponsorId,
    _slot_slug: slotSlug,
    _event_type: eventType,
    _page_path: window.location.pathname,
  } as any).then(() => {});
}

const AdSlot = ({ slotSlug, className = '', layout = 'banner', category, city, state, maxAds }: AdSlotProps) => {
  const { data: sponsors = [] } = useSlotSponsors(slotSlug, category, city, state);
  const tracked = useRef(new Set<string>());
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track impressions
  useEffect(() => {
    if (sponsors.length === 0) return;
    if (layout === 'sidebar' || layout === 'native') {
      sponsors.forEach(s => {
        if (!tracked.current.has(s.id)) {
          tracked.current.add(s.id);
          trackMetric(s.id, slotSlug, 'impression');
        }
      });
    } else {
      const s = sponsors[currentIndex];
      if (s && !tracked.current.has(s.id)) {
        tracked.current.add(s.id);
        trackMetric(s.id, slotSlug, 'impression');
      }
    }
  }, [sponsors, currentIndex, layout, slotSlug]);

  // Rotate for single-display
  useEffect(() => {
    if (layout !== 'banner' || sponsors.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % sponsors.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [sponsors.length, layout]);

  if (sponsors.length === 0) return null;

  const handleClick = (s: SlotSponsor) => {
    trackMetric(s.id, slotSlug, 'click');
  };

  // Sidebar layout
  if (layout === 'sidebar') {
    return (
      <div className={`space-y-3 ${className}`}>
        {sponsors.map(s => (
          <a
            key={s.id}
            href={s.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(s)}
            className="block rounded-xl bg-card p-3 shadow-sm transition-all hover:shadow-md"
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
            {s.image_url && (
              <SponsorImage src={s.image_url} alt={s.title} containerClassName="mt-2 rounded-lg" />
            )}
            <p className="mt-2 text-xs font-medium text-foreground">{s.title}</p>
          </a>
        ))}
      </div>
    );
  }

  // Native card layout
  if (layout === 'native') {
    return (
      <div className={`${className}`}>
        {sponsors.slice(0, maxAds || 1).map(s => (
          <a
            key={s.id}
            href={s.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(s)}
            className="block rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md"
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
            {s.image_url && (
              <SponsorImage src={s.image_url} alt={s.title} containerClassName="mt-2 rounded-lg" />
            )}
            <p className="mt-2 text-sm font-medium text-foreground">{s.title}</p>
          </a>
        ))}
      </div>
    );
  }

  // Inline layout
  if (layout === 'inline') {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`}>
        {sponsors.map(s => (
          <a
            key={s.id}
            href={s.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(s)}
            className="opacity-60 transition-opacity hover:opacity-100"
            title={s.title}
          >
            {s.image_url ? (
              <img src={s.image_url} alt={s.title} className="h-8 max-w-[140px] object-contain" loading="lazy" />
            ) : (
              <span className="text-xs text-muted-foreground">{s.title}</span>
            )}
          </a>
        ))}
      </div>
    );
  }

  // Banner layout (default - rotational)
  const current = sponsors[currentIndex] || sponsors[0];
  return (
    <section className={`py-4 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="rounded-xl bg-muted/30 p-3">
          <span className="mb-2 block text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Patrocinado</span>
          <a
            href={current.link_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleClick(current)}
            className="block text-center transition-opacity hover:opacity-80"
            title={current.title}
          >
            {current.image_url ? (
              <SponsorImage src={current.image_url} alt={current.title} containerClassName="mx-auto rounded-lg" />
            ) : (
              <span className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">{current.title}</span>
            )}
          </a>
          {sponsors.length > 1 && (
            <div className="mt-2 flex justify-center gap-1">
              {sponsors.map((_, i) => (
                <div key={i} className={`h-1 w-4 rounded-full transition-colors ${i === currentIndex ? 'bg-accent' : 'bg-muted-foreground/20'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export { useSlotSponsors, trackMetric };
export default AdSlot;
