import { useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ChevronLeft, ChevronRight, Newspaper, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FadeInSection from '@/components/FadeInSection';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const BlogHighlight = () => {
  const blogEnabled = useFeatureEnabled('module_blog');

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
    staleTime: 1000 * 60 * 15,
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

  if (!blogEnabled || displayed.length === 0) return null;

  return (
    <section className="bg-gradient-to-b from-muted/40 to-background py-10">
      <div className="container">
        <FadeInSection>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-2">
                <Newspaper className="h-3.5 w-3.5" />
                Fique por dentro
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">Portal de Notícias</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Informação útil para profissionais e clientes</p>
            </div>
            <div className="flex items-center gap-2">
              {displayed.length > 3 && (
                <div className="hidden sm:flex gap-1">
                  <button onClick={() => scroll('left')} disabled={!canScrollLeft} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors border border-border">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => scroll('right')} disabled={!canScrollRight} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors border border-border">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link to="/blog">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </div>
        </FadeInSection>

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {displayed.map((post, idx) => (
            <FadeInSection key={post.id} delay={idx * 0.04} className="flex-shrink-0 w-[220px] sm:w-[250px] snap-start">
              <Link
                to={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 h-full"
              >
                <div className="relative overflow-hidden">
                  {post.cover_image_url ? (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-[4/3] w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <Newspaper className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="font-display text-xs font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words leading-snug">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2 flex-1">{post.excerpt}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                    <Calendar className="h-3 w-3" />
                    {formatDate(post.created_at)}
                  </div>
                </div>
              </Link>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogHighlight;
