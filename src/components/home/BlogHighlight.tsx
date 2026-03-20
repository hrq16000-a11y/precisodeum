import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BlogHighlight = () => {
  const { data: post } = useQuery({
    queryKey: ['blog-featured-home'],
    queryFn: async () => {
      // Try featured first, fallback to latest
      let { data } = await supabase.from('blog_posts').select('id, title, slug, excerpt, cover_image_url, created_at')
        .eq('published', true).eq('featured', true).order('created_at', { ascending: false }).limit(1).single();
      if (!data) {
        const res = await supabase.from('blog_posts').select('id, title, slug, excerpt, cover_image_url, created_at')
          .eq('published', true).order('created_at', { ascending: false }).limit(1).single();
        data = res.data;
      }
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (!post) return null;

  return (
    <section className="py-8">
      <div className="container">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-foreground">📰 Blog</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/blog">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <Link to={`/blog/${post.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lg sm:flex-row">
          {post.cover_image_url && (
            <img src={post.cover_image_url} alt={post.title} className="h-40 w-full object-cover sm:h-auto sm:w-72" loading="lazy" />
          )}
          <div className="flex flex-col justify-center p-5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Destaque</span>
            <h3 className="mt-1 font-display text-lg font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2">{post.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
            <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />{new Date(post.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default BlogHighlight;
