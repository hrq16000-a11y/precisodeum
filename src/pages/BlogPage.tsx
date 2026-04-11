import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FadeInSection from '@/components/FadeInSection';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ArrowRight, Sparkles, Newspaper, User } from 'lucide-react';
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

const PostCard = ({ post, highlight = false }: { post: any; highlight?: boolean }) => (
  <Link
    to={`/blog/${post.slug}`}
    className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-all hover:shadow-card-hover ${
      highlight ? 'border-accent/30' : 'border-border'
    }`}
  >
    {post.cover_image_url ? (
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={post.cover_image_url}
          alt={post.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>
    ) : (
      <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
        <Newspaper className="h-10 w-10 text-muted-foreground/40" />
      </div>
    )}
    <div className="flex flex-1 flex-col p-4">
      <h3 className="font-display text-sm font-bold leading-snug text-foreground group-hover:text-accent transition-colors line-clamp-2 break-words sm:text-base">
        {post.title}
      </h3>
      {post.excerpt && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 break-words sm:text-sm">
          {post.excerpt}
        </p>
      )}
      <div className="mt-auto flex items-center gap-3 pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3 shrink-0" />
          {new Date(post.created_at).toLocaleDateString('pt-BR')}
        </span>
        {post.author_name && (
          <span className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 shrink-0" />
            {post.author_name}
          </span>
        )}
      </div>
    </div>
  </Link>
);

const BlogPage = () => {
  useSeoHead({
    title: 'Notícias | Preciso de um',
    description: 'Dicas, novidades e conteúdos sobre serviços profissionais.',
    canonical: `${SITE_BASE_URL}/blog`,
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts-public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, author_name, created_at, featured')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
    refetchInterval: 1000 * 60 * 60,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const highlights = useMemo(() => shuffle(posts).slice(0, Math.min(6, posts.length)), [posts]);
  const highlightIds = new Set(highlights.map((h) => h.id));
  const rest = posts.filter((p) => !highlightIds.has(p.id));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <FadeInSection className="bg-hero py-8 sm:py-12" blur={false}>
        <div className="container px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="font-display text-2xl font-bold text-primary-foreground sm:text-3xl lg:text-4xl"
          >
            📰 Notícias
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-2 max-w-lg text-sm text-primary-foreground/80 sm:text-base"
          >
            Dicas, novidades e conteúdos sobre serviços profissionais
          </motion.p>
        </div>
      </FadeInSection>

      <main className="container flex-1 px-4 py-6 sm:py-8">
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <Newspaper className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-foreground">Nenhuma notícia publicada ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Em breve teremos novidades!</p>
          </div>
        ) : (
          <>
             {highlights.length > 0 && (
              <FadeInSection viewportTrigger direction="up" delay={0.1}>
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-lg font-bold text-foreground">Destaques</h2>
                </div>
                <motion.div
                  className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
                >
                  {highlights.map((p) => (
                    <motion.div
                      key={p.id}
                      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                    >
                      <PostCard post={p} highlight />
                    </motion.div>
                  ))}
                </motion.div>
              </FadeInSection>
            )}

            {rest.length > 0 && (
              <FadeInSection viewportTrigger direction="up" delay={0.2} className="mt-8 sm:mt-10">
                <h2 className="mb-4 font-display text-lg font-bold text-foreground">
                  Todas as Publicações
                </h2>
                <motion.div
                  className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                >
                  {rest.map((p) => (
                    <motion.div
                      key={p.id}
                      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                    >
                      <PostCard post={p} />
                    </motion.div>
                  ))}
                </motion.div>
              </FadeInSection>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BlogPage;
