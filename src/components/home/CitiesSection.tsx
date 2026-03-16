import { Link } from 'react-router-dom';

interface City {
  name: string;
  slug: string;
  state: string;
}

interface Props {
  cities: City[];
}

const CitiesSection = ({ cities }: Props) => (
  <section className="py-14">
    <div className="container">
      <div className="mb-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
          Profissionais por Cidade
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre profissionais nas maiores cidades do Brasil
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {cities.map((city) => (
          <Link
            key={city.slug}
            to={`/cidade/${city.slug}`}
            className="rounded-xl border border-border bg-card p-4 text-center shadow-card transition-colors hover:border-primary hover:-translate-y-0.5"
          >
            <span className="font-display text-sm font-bold text-foreground">{city.name}</span>
            <span className="ml-1 text-xs text-muted-foreground">- {city.state}</span>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

export default CitiesSection;
