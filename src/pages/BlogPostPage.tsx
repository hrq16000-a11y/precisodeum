import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ArrowLeft, ExternalLink, User, Newspaper } from 'lucide-react';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

/** Strip HTML tags and decode common entities */
function stripHtmlTags(rawHtml: string): string {
  let html = rawHtml || '';

  for (let i = 0; i < 2; i++) {
    html = html
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\s*\/\s*(div|li|h1|h2|h3|h4|h5|h6)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: relatedPosts = [] } = useQuery({
    queryKey: ['blog-related', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, created_at')
        .eq('published', true)
        .neq('slug', slug!)
        .order('created_at', { ascending: false })
        .limit(3);
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container max-w-3xl flex-1 px-4 py-6 sm:py-8">
        {/* Back button */}
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/blog">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao Blog
          </Link>
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !post ? (
          <div className="py-16 text-center">
            <Newspaper className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-foreground">Post não encontrado</p>
            <Button className="mt-4" asChild>
              <Link to="/blog">Ver todos os posts</Link>
            </Button>
          </div>
        ) : (
          <article className="space-y-6">
            {/* Title */}
            <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl lg:text-4xl break-words">
              {post.title}
            </h1>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {new Date(post.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              {post.author_name && (
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 shrink-0" />
                  {post.author_name}
                </span>
              )}
              {post.source_url && (
                <a
                  href={post.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent hover:underline"
                >
                  Fonte <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Cover image */}
            {post.cover_image_url ? (
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full rounded-xl object-cover max-h-[420px]"
              />
            ) : (
              <div className="flex aspect-video max-h-[280px] w-full items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
                <Newspaper className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}

            {/* Excerpt as lead paragraph */}
            {post.excerpt && (
              <p className="text-base font-medium leading-relaxed text-muted-foreground italic border-l-4 border-accent/40 pl-4 break-words">
                {post.excerpt}
              </p>
            )}

            {/* Content body */}
            <div className="prose prose-sm sm:prose-base max-w-none text-foreground dark:prose-invert prose-headings:text-foreground prose-p:leading-relaxed prose-a:text-accent break-words">
              {stripHtmlTags(post.content).split('\n').map((paragraph: string, i: number) => {
                const trimmed = paragraph.trim();
                if (!trimmed) return null;
                return (
                  <p key={i} className="mb-4 last:mb-0 break-words">
                    {trimmed}
                  </p>
                );
              })}
            </div>

            {/* Source link at bottom */}
            {post.source_url && (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  📰 Fonte original:{' '}
                  <a
                    href={post.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline break-all"
                  >
                    {post.source_url}
                  </a>
                </p>
              </div>
            )}
          </article>
        )}

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-10 border-t border-border pt-8 sm:mt-12">
            <h2 className="font-display text-xl font-bold text-foreground mb-5">Mais Notícias</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              {relatedPosts.map((p: any) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-card-hover"
                >
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt={p.title}
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <Newspaper className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">
                      {p.title}
                    </h3>
                    {p.excerpt && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words">
                        {p.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BlogPostPage;
