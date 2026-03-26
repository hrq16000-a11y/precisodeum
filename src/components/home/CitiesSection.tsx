import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';
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
    <section className="py-8">
      <div className="container">
        <div className="mb-6 text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Profissionais por Cidade
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Encontre profissionais nas cidades com serviços ativos
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {randomCities.map((city) => (
            <Link
              key={city.slug}
              to={`/cidade/${city.slug}`}
              className="rounded-xl border border-border bg-card p-3 text-center shadow-card transition-all hover:border-primary hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <MapPin className="mx-auto mb-1 h-3.5 w-3.5 text-accent" />
              <span className="font-display text-xs font-bold text-foreground sm:text-sm">{city.name}</span>
              <span className="ml-1 text-[10px] text-muted-foreground">- {city.state}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5" asChild>
            <Link to="/cidades">Ver mais cidades <ChevronRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CitiesSection;
