import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Highlight {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
}

const HighlightsCarousel = () => {
  const { data: highlights = [] } = useQuery({
    queryKey: ['highlights-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('highlights' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as unknown as Highlight[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setCurrent(prev => (prev + 1) % highlights.length), [highlights.length]);
  const prev = useCallback(() => setCurrent(prev => (prev - 1 + highlights.length) % highlights.length), [highlights.length]);

  useEffect(() => {
    if (highlights.length <= 1 || paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [highlights.length, paused, next]);

  if (highlights.length === 0) return null;

  const h = highlights[current];
  const hasImage = !!h.image_url;

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (h.link_url) {
      const isExternal = h.link_url.startsWith('http');
      if (isExternal) {
        return <a href={h.link_url} target="_blank" rel="noopener noreferrer" className="block">{children}</a>;
      }
      return <Link to={h.link_url} className="block">{children}</Link>;
    }
    return <>{children}</>;
  };

  return (
    <section className="py-6">
      <div className="container">
        <div
          className="relative overflow-hidden rounded-2xl border border-border shadow-card group"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Wrapper>
            {hasImage ? (
              <div className="relative">
                <img
                  src={h.image_url!}
                  alt={h.title}
                  className="w-full h-40 sm:h-56 md:h-64 object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Destaque</span>
                  </div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white drop-shadow-md line-clamp-2">
                    {h.title}
                  </h3>
                  {h.description && (
                    <p className="mt-1 text-sm text-white/80 line-clamp-2 max-w-xl">
                      {h.description}
                    </p>
                  )}
                  {h.link_url && (
                    <span className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                      Saiba mais →
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-5 sm:p-6 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent/10 sm:flex">
                  <Sparkles className="h-7 w-7 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent sm:hidden" />
                    <h3 className="font-display text-base font-bold text-foreground sm:text-lg">
                      {h.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {h.description}
                  </p>
                  {h.link_url && (
                    <span className="mt-2 inline-block text-sm font-semibold text-accent hover:underline">
                      Saiba mais →
                    </span>
                  )}
                </div>
              </div>
            )}
          </Wrapper>

          {/* Navigation arrows */}
          {highlights.length > 1 && (
            <>
              <button
                onClick={(e) => { e.preventDefault(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Dots */}
          {highlights.length > 1 && (
            <div className={`flex justify-center gap-1.5 ${hasImage ? 'absolute bottom-2 left-0 right-0 z-10' : 'pb-3'}`}>
              {highlights.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); setCurrent(i); }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? 'w-6 bg-accent' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HighlightsCarousel;
