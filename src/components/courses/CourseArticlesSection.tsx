import { Link } from 'react-router-dom';
import { CalendarDays, Newspaper, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CourseArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
  featured?: boolean | null;
}

const CourseArticlesSection = ({ articles }: { articles: CourseArticle[] }) => {
  if (!articles.length) return null;

  const featured = articles.find((article) => article.featured) ?? articles[0];
  const rest = articles.filter((article) => article.id !== featured.id);

  return (
    <section className="mt-12 border-t border-border/60 pt-8" aria-labelledby="course-articles-title">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 id="course-articles-title" className="font-display text-xl font-bold text-foreground">
            Matérias sobre cursos
          </h2>
        </div>
        <Link to="/blog" className="hidden text-sm text-accent hover:underline sm:inline-flex">
          Ver notícias
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Link to={`/cursos/materias/${featured.slug}`} className="group overflow-hidden rounded-xl border border-accent/20 bg-card shadow-card transition-all hover:shadow-card-hover">
          {featured.cover_image_url ? (
            <img src={featured.cover_image_url} alt={featured.title} className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-muted/50">
              <Newspaper className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          <div className="p-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(featured.created_at).toLocaleDateString('pt-BR')}
            </div>
            <h3 className="font-display text-lg font-bold leading-tight text-foreground group-hover:text-accent sm:text-xl">
              {featured.title}
            </h3>
            {featured.excerpt && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{featured.excerpt}</p>}
            <Button className="mt-4 gap-2" size="sm">
              Abrir matéria <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Link>

        <div className="grid gap-3">
          {rest.map((article) => (
            <Link key={article.id} to={`/cursos/materias/${article.slug}`} className="group grid grid-cols-[112px_1fr] gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-accent/30">
              {article.cover_image_url ? (
                <img src={article.cover_image_url} alt={article.title} className="h-24 w-full rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg bg-muted/50">
                  <Newspaper className="h-7 w-7 text-muted-foreground/40" />
                </div>
              )}
              <div className="min-w-0">
                <p className="mb-1 text-[11px] text-muted-foreground">{new Date(article.created_at).toLocaleDateString('pt-BR')}</p>
                <h3 className="line-clamp-3 text-sm font-bold leading-snug text-foreground group-hover:text-accent">{article.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CourseArticlesSection;