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
    const links = categories.slice(0, 6).flatMap((cat) =>
      cities.slice(0, 4).map((city) => ({
        key: `${cat.slug}-${city.slug}`,
        to: `/${cat.slug}-${city.slug}`,
        label: `${cat.name} em ${city.name}`,
      }))
    );
    return shuffle(links);
  }, [categories, cities]);

  const visible = showAll ? allLinks : allLinks.slice(0, 4);

  return (
    <section className="bg-muted/50 py-10">
      <div className="container">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Buscas Populares</h2>
          <p className="mt-2 text-muted-foreground">As buscas mais realizadas na plataforma</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {visible.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
        {!showAll && allLinks.length > 4 && (
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              Ver mais buscas
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularSearches;
