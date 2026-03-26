import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
    // Shuffle BOTH arrays before slicing to avoid alphabetical bias (bug fix)
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

  // Show 3 initially (not 4) per requirement
  const visible = showAll ? allLinks : allLinks.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <section className="bg-muted/50 py-8">
      <div className="container">
        <div className="mb-5 text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">Buscas Populares</h2>
          <p className="mt-1 text-xs text-muted-foreground">As buscas mais realizadas na plataforma</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {visible.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
        {!showAll && allLinks.length > 3 && (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="text-xs">
              Ver mais buscas
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularSearches;
