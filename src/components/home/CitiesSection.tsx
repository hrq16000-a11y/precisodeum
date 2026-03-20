import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface City {
  name: string;
  slug: string;
  state: string;
}

interface Props {
  cities: City[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CitiesSection = ({ cities }: Props) => {
  const randomCities = useMemo(() => shuffle(cities).slice(0, 6), [cities]);

  if (randomCities.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Profissionais por Cidade
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Encontre profissionais nas cidades com serviços ativos
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
          {randomCities.map((city) => (
            <Link
              key={city.slug}
              to={`/cidade/${city.slug}`}
              className="rounded-xl border border-border bg-card p-4 text-center shadow-card transition-all hover:border-primary hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <MapPin className="mx-auto mb-1 h-4 w-4 text-accent" />
              <span className="font-display text-sm font-bold text-foreground">{city.name}</span>
              <span className="ml-1 text-xs text-muted-foreground">- {city.state}</span>
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" className="rounded-full" asChild>
            <Link to="/buscar">Ver mais cidades <ChevronDown className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CitiesSection;
