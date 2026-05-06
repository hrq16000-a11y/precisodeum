import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FadeInSection from '@/components/FadeInSection';

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
        <FadeInSection className="mb-6 text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Profissionais por Cidade
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Encontre profissionais nas cidades com serviços ativos
          </p>
        </FadeInSection>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {randomCities.map((city, i) => (
            <FadeInSection key={city.slug} delay={i * 0.06}>
              <Link
                to={`/cidade/${city.slug}`}
                className="group flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center shadow-card transition-all duration-300 hover:border-primary/40 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 transition-transform duration-300 group-hover:scale-110">
                  <MapPin className="h-4 w-4 text-accent" />
                </div>
                <span className="mt-2 font-display text-sm font-bold text-foreground">{city.name}</span>
                <span className="text-[11px] text-muted-foreground">{city.state}</span>
              </Link>
            </FadeInSection>
          ))}
        </div>
        <FadeInSection delay={0.3} className="mt-5 text-center">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5" asChild>
            <Link to="/cidades">Ver mais cidades <ChevronRight className="h-3 w-3" /></Link>
          </Button>
        </FadeInSection>
      </div>
    </section>
  );
};

export default CitiesSection;
