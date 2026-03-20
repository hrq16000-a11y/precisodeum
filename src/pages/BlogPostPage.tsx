import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ArrowLeft, ExternalLink } from 'lucide-react';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data } = await supabase.from('blog_posts').select('*').eq('slug', slug).eq('published', true).single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: relatedPosts = [] } = useQuery({
    queryKey: ['blog-related', slug],
    queryFn: async () => {
      const { data } = await supabase.from('blog_posts').select('id, title, slug, excerpt, cover_image_url, created_at')
        .eq('published', true).neq('slug', slug!).order('created_at', { ascending: false }).limit(3);
      return data || [];
    },
    enabled: !!slug,
  });

  useSeoHead({
    title: post?.title ? `${post.title} | Preciso de um` : 'Blog | Preciso de um',
    description: post?.excerpt || 'Confira as últimas notícias e dicas do Preciso de um.',
    canonical: `${SITE_BASE_URL}/blog/${slug}`,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container max-w-3xl py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/blog"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao Blog</Link>
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !post ? (
          <div className="text-center py-16">
            <p className="text-lg font-medium text-foreground">Post não encontrado</p>
            <Button variant="accent" className="mt-4" asChild><Link to="/blog">Ver todos os posts</Link></Button>
          </div>
        ) : (
          <article>
            <h1 className="font-display text-3xl font-bold text-foreground leading-tight">{post.title}</h1>
            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{new Date(post.created_at).toLocaleDateString('pt-BR')}</span>
              <span>Por {post.author_name}</span>
              {post.source_url && (
                <a href={post.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                  Fonte <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {post.cover_image_url && (
              <img src={post.cover_image_url} alt={post.title} className="mt-6 w-full rounded-xl object-cover max-h-[400px]" />
            )}
            <div className="prose prose-sm max-w-none mt-6 text-foreground dark:prose-invert whitespace-pre-wrap">
              {post.content}
            </div>
          </article>
        )}

        {relatedPosts.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h2 className="font-display text-xl font-bold text-foreground mb-4">Mais Notícias</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {relatedPosts.map((p: any) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="group rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-lg">
                  {p.cover_image_url && <img src={p.cover_image_url} alt={p.title} className="h-28 w-full rounded-lg object-cover mb-3" loading="lazy" />}
                  <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2">{p.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default BlogPostPage;
