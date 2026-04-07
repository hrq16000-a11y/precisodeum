import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown } from 'lucide-react';
import FadeInSection from '@/components/FadeInSection';

interface Props {
  categories: { name: string; slug: string }[];
  cities: { name: string; slug: string }[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PopularSearches = ({ categories, cities }: Props) => {
  const [showAll, setShowAll] = useState(false);

  const allLinks = useMemo(() => {
    const shuffledCats = shuffle(categories).slice(0, 6);
    const shuffledCities = shuffle(cities).slice(0, 4);
    const links = shuffledCats.flatMap((cat) =>
      shuffledCities.map((city) => ({
        key: `${cat.slug}-${city.slug}`,
        to: `/${cat.slug}-${city.slug}`,
        label: `${cat.name} em ${city.name}`,
      }))
    );
    return shuffle(links);
  }, [categories, cities]);

  const visible = showAll ? allLinks : allLinks.slice(0, 8);

  if (visible.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <FadeInSection className="mb-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground mb-3">
            <Search className="h-3.5 w-3.5" />
            SEO & Descoberta
          </div>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Buscas Populares
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">As buscas mais realizadas na plataforma</p>
        </FadeInSection>

        <FadeInSection delay={0.1}>
          <div className="flex flex-wrap justify-center gap-2">
            {visible.map((link, i) => (
              <Link
                key={link.key}
                to={link.to}
                className="group rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground transition-all duration-300 hover:border-primary hover:text-primary hover:bg-primary/5 hover:shadow-sm hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="flex items-center gap-1.5">
                  <Search className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </FadeInSection>

        {!showAll && allLinks.length > 8 && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(true)}
              className="text-xs gap-1 rounded-full"
            >
              <ChevronDown className="h-3 w-3" />
              Ver mais buscas
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularSearches;
