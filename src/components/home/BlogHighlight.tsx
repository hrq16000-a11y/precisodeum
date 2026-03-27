import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react';
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
        .select('id, title, slug, cover_image_url, created_at')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 60,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const displayed = useMemo(() => shuffle(posts).slice(0, 3), [posts]);

  if (displayed.length === 0) return null;

  return (
    <section className="bg-muted/30 py-8">
      <div className="container">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">📰 Portal de Notícias</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Informação útil para profissionais e clientes</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/blog">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {displayed.map((post) => (
            <Link
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lg"
            >
              {post.cover_image_url ? (
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                  <Newspaper className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-3">
                <h3 className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
                  {post.title}
                </h3>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(post.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogHighlight;
