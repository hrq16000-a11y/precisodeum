import { useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ChevronLeft, ChevronRight, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BlogHighlight = () => {
  const { data: posts = [] } = useQuery({
    queryKey: ['blog-highlight-home'],
    queryFn: async () => {
      const { data } = await supabase.from('blog_posts')
        .select('id, title, slug, cover_image_url, excerpt, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(12);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 60,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const displayed = useMemo(() => shuffle(posts).slice(0, 8), [posts]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  if (displayed.length === 0) return null;

  return (
    <section className="bg-muted/30 py-8">
      <div className="container">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">📰 Portal de Notícias</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Informação útil para profissionais e clientes</p>
          </div>
          <div className="flex items-center gap-2">
            {displayed.length > 3 && (
              <div className="hidden sm:flex gap-1">
                <button onClick={() => scroll('left')} disabled={!canScrollLeft} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => scroll('right')} disabled={!canScrollRight} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/blog">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {displayed.map((post) => (
            <Link
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group flex-shrink-0 w-[200px] sm:w-[220px] snap-start overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lg"
            >
              {post.cover_image_url ? (
                <img src={post.cover_image_url} alt={post.title} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              ) : (
                <div className="aspect-[4/3] w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                  <Newspaper className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-2.5">
                <h3 className="font-display text-xs font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words leading-snug">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{post.excerpt}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogHighlight;
