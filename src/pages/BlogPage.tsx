import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays } from 'lucide-react';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

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
        .eq('published', true).order('created_at', { ascending: false }).limit(30);
      return data || [];
    },
  });

  const featured = posts.find((p: any) => p.featured) || posts[0];
  const rest = posts.filter((p: any) => p.id !== featured?.id);

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
            {/* Featured post */}
            {featured && (
              <Link to={`/blog/${featured.slug}`} className="group mt-6 block min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lg sm:mt-8">
                <div className="flex flex-col sm:flex-row">
                  {featured.cover_image_url && (
                    <img src={featured.cover_image_url} alt={featured.title} className="h-48 w-full object-cover sm:h-auto sm:w-1/2" />
                  )}
                  <div className="min-w-0 p-5 flex flex-col justify-center sm:p-6">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Destaque</span>
                    <h2 className="mt-2 font-display text-lg font-bold text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words sm:text-xl">{featured.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3 break-words">{featured.excerpt}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3 shrink-0" />{new Date(featured.created_at).toLocaleDateString('pt-BR')}
                      <span>· {featured.author_name}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Grid */}
            <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 sm:mt-8">
              {rest.map((p: any) => (
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
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default BlogPage;
