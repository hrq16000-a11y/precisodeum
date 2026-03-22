import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, ArrowRight } from 'lucide-react';
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
  });

  const displayed = useMemo(() => shuffle(posts).slice(0, 3), [posts]);

  if (displayed.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-foreground">📰 Blog</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/blog">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {displayed.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lg">
              {post.cover_image_url && (
                <img src={post.cover_image_url} alt={post.title} className="aspect-video w-full object-cover" loading="lazy" />
              )}
              <div className="p-3">
                <h3 className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">{post.title}</h3>
                <span className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />{new Date(post.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogHighlight;
