import { Link } from 'react-router-dom';

interface Props {
  categories: { name: string; slug: string }[];
  cities: { name: string; slug: string }[];
}

const PopularSearches = ({ categories, cities }: Props) => (
  <section className="bg-muted/50 py-14">
    <div className="container">
      <div className="mb-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Buscas Populares</h2>
        <p className="mt-2 text-muted-foreground">As buscas mais realizadas na plataforma</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {categories.slice(0, 6).flatMap((cat) =>
          cities.slice(0, 4).map((city) => (
            <Link
              key={`${cat.slug}-${city.slug}`}
              to={`/${cat.slug}-${city.slug}`}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {cat.name} em {city.name}
            </Link>
          ))
        )}
      </div>
    </div>
  </section>
);

export default PopularSearches;
