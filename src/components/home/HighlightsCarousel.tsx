import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { icons, ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/tracking';

interface Highlight {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  icon: string | null;
  theme_color: string | null;
  button_text: string | null;
  start_date: string | null;
  end_date: string | null;
  click_count: number;
}

/** Map Tailwind text-color class to a raw hex/hsl for box-shadow glow */
const colorMap: Record<string, string> = {
  'text-orange-500': '249 115 22',
  'text-blue-500': '59 130 246',
  'text-emerald-500': '16 185 129',
  'text-red-500': '239 68 68',
  'text-purple-500': '168 85 247',
  'text-pink-500': '236 72 153',
  'text-yellow-500': '234 179 8',
  'text-teal-500': '20 184 166',
};

/** Map Tailwind text-color class to a soft bg class */
const bgMap: Record<string, string> = {
  'text-orange-500': 'bg-orange-500/10',
  'text-blue-500': 'bg-blue-500/10',
  'text-emerald-500': 'bg-emerald-500/10',
  'text-red-500': 'bg-red-500/10',
  'text-purple-500': 'bg-purple-500/10',
  'text-pink-500': 'bg-pink-500/10',
  'text-yellow-500': 'bg-yellow-500/10',
  'text-teal-500': 'bg-teal-500/10',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const INTERVAL = 5000;

const HighlightsCarousel = () => {
  const { data: rawHighlights = [] } = useQuery({
    queryKey: ['highlights-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('highlights' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as unknown as Highlight[];
    },
    staleTime: 1000 * 60 * 15,
  });

  // Filter by date range on the client
  const filtered = useMemo(() => {
    const now = new Date();
    return rawHighlights.filter((h) => {
      if (h.start_date && new Date(h.start_date) > now) return false;
      if (h.end_date && new Date(h.end_date) < now) return false;
      return true;
    });
  }, [rawHighlights]);

  // Shuffle once per mount / data change
  const highlights = useMemo(() => shuffle(filtered), [filtered]);

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % highlights.length);
    setProgressKey((k) => k + 1);
  }, [highlights.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + highlights.length) % highlights.length);
    setProgressKey((k) => k + 1);
  }, [highlights.length]);

  const goTo = (i: number) => {
    setCurrent(i);
    setProgressKey((k) => k + 1);
  };

  useEffect(() => {
    if (highlights.length <= 1 || paused) return;
    const timer = setInterval(next, INTERVAL);
    return () => clearInterval(timer);
  }, [highlights.length, paused, next]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    setPaused(false);
  };

  // Track CTA click
  const handleCtaClick = async (h: Highlight) => {
    trackEvent({ event: 'click_highlight' as any, extra: { highlight_id: h.id, title: h.title } });
    try {
      await (supabase.rpc as any)('increment_highlight_clicks', { highlight_id: h.id });
    } catch { /* non-critical */ }
  };

  if (highlights.length === 0) return null;

  const h = highlights[current];
  const IconComponent = h.icon ? (icons as Record<string, any>)[h.icon] : null;
  const color = h.theme_color || 'text-orange-500';
  const glowRgb = colorMap[color] || '249 115 22';
  const bgSoft = bgMap[color] || 'bg-orange-500/10';

  return (
    <section className="py-4">
      <div className="container">
        <div
          className={`group relative overflow-hidden rounded-2xl border border-border bg-slate-50 shadow-card transition-transform duration-300 ${
            hovered ? '-translate-y-1' : ''
          }`}
          onMouseEnter={() => { setPaused(true); setHovered(true); }}
          onMouseLeave={() => { setPaused(false); setHovered(false); }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2">
              {/* Glow icon container */}
              {IconComponent && (
                <div
                  className={`rounded-xl p-2.5 ${bgSoft} transition-shadow duration-300`}
                  style={{ boxShadow: `0 0 16px 2px rgb(${glowRgb} / 0.25)` }}
                >
                  <IconComponent size={20} className={color} />
                </div>
              )}
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
                onClick={() => handleCtaClick(h)}
                className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold ${color} hover:underline`}
              >
                {h.button_text || 'Saiba mais →'}
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:animate-[bounce-x_1s_ease-in-out_infinite]"
                />
              </Link>
            )}
          </div>

          {/* Progress pills */}
          {highlights.length > 1 && (
            <div className="flex justify-center gap-1.5 pb-4">
              {highlights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="relative h-2 rounded-full bg-gray-200 overflow-hidden transition-all"
                  style={{ width: i === current ? '2rem' : '0.5rem' }}
                >
                  {i === current && (
                    <span
                      key={progressKey}
                      className="absolute inset-0 rounded-full bg-orange-500"
                      style={{
                        animation: paused ? 'none' : `progress-fill ${INTERVAL}ms linear forwards`,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Keyframes injected once */}
      <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
      `}</style>
    </section>
  );
};

export default HighlightsCarousel;
