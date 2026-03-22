import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BlogPage = () => {
  useSeoHead({
    title: 'Blog e Notícias | Preciso de um',
    description: 'Dicas, novidades e conteúdos sobre serviços profissionais.',
    canonical: `${SITE_BASE_URL}/blog`,
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts-public'],
    queryFn: async () => {
      const { data } = await supabase.from('blog_posts').select('id, title, slug, excerpt, cover_image_url, author_name, created_at, featured')
        .eq('published', true).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const highlights = useMemo(() => shuffle(posts).slice(0, Math.min(6, posts.length)), [posts]);
  const highlightIds = new Set(highlights.map(h => h.id));
  const rest = posts.filter(p => !highlightIds.has(p.id));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container px-4 py-6 sm:py-8">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Blog & Notícias</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">Dicas, novidades e conteúdos sobre serviços profissionais</p>

        {isLoading ? (
          <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-lg font-medium text-foreground">Nenhum post publicado ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Em breve teremos novidades!</p>
          </div>
        ) : (
          <>
            {/* Highlights section */}
            {highlights.length > 0 && (
              <section className="mt-6 sm:mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-lg font-bold text-foreground">Destaques</h2>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {highlights.map((p) => (
                    <Link key={p.id} to={`/blog/${p.slug}`} className="group min-w-0 overflow-hidden rounded-xl border border-accent/20 bg-card shadow-card transition-all hover:shadow-lg">
                      {p.cover_image_url && <img src={p.cover_image_url} alt={p.title} className="aspect-video w-full object-cover" loading="lazy" />}
                      <div className="p-4">
                        <h3 className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">{p.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words">{p.excerpt}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3 shrink-0" />{new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Rest of posts */}
            {rest.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-4 font-display text-lg font-bold text-foreground">Todas as Publicações</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => (
                    <Link key={p.id} to={`/blog/${p.slug}`} className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lg">
                      {p.cover_image_url && <img src={p.cover_image_url} alt={p.title} className="aspect-video w-full object-cover" loading="lazy" />}
                      <div className="p-4">
                        <h3 className="font-display text-sm font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words">{p.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words">{p.excerpt}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3 shrink-0" />{new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default BlogPage;
