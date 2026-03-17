import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (highlights.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % highlights.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [highlights.length]);

  if (highlights.length === 0) return null;

  const h = highlights[current];

  return (
    <section className="py-6">
      <div className="container">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 shadow-card">
          <div className="flex items-center gap-4 p-5 sm:p-6">
            {h.image_url ? (
              <img
                src={h.image_url}
                alt={h.title}
                className="hidden h-20 w-20 shrink-0 rounded-xl object-cover sm:block"
              />
            ) : (
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent/10 sm:flex">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
            )}
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
                <Link
                  to={h.link_url}
                  className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
                >
                  Saiba mais →
                </Link>
              )}
            </div>

            {highlights.length > 1 && (
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => setCurrent((prev) => (prev - 1 + highlights.length) % highlights.length)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrent((prev) => (prev + 1) % highlights.length)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {highlights.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-3">
              {highlights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/30'
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
