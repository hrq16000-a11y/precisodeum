import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { icons } from 'lucide-react';

interface Highlight {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  icon: string | null;
  theme_color: string | null;
  button_text: string | null;
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

  useEffect(() => {
    if (highlights.length <= 1 || paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [highlights.length, paused, next]);

  if (highlights.length === 0) return null;

  const h = highlights[current];
  const IconComponent = h.icon ? (icons as Record<string, any>)[h.icon] : null;
  const color = h.theme_color || 'text-orange-500';

  return (
    <section className="py-4">
      <div className="container">
        <div
          className="relative overflow-hidden rounded-2xl border border-border bg-slate-50 shadow-card"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2">
              {IconComponent && <IconComponent size={20} className={color} />}
              <h3 className="font-display text-base font-bold text-foreground sm:text-lg">
                {h.title}
              </h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              {h.description}
            </p>
            {h.link_url && (
              <Link
                to={h.link_url}
                className={`mt-3 inline-block text-sm font-semibold ${color} hover:underline`}
              >
                {h.button_text || 'Saiba mais →'}
              </Link>
            )}
          </div>

          {/* Dots */}
          {highlights.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-4">
              {highlights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all ${
                    i === current ? 'w-4 h-2 bg-orange-500' : 'w-2 h-2 bg-gray-200'
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
