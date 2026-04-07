import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight, Building2 } from 'lucide-react';
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

const stateColors: Record<string, string> = {
  SP: 'from-blue-500/10 to-blue-600/5',
  RJ: 'from-orange-500/10 to-orange-600/5',
  MG: 'from-red-500/10 to-red-600/5',
  PR: 'from-green-500/10 to-green-600/5',
  SC: 'from-teal-500/10 to-teal-600/5',
  RS: 'from-indigo-500/10 to-indigo-600/5',
};

const CitiesSection = ({ cities }: Props) => {
  const randomCities = useMemo(() => shuffle(cities).slice(0, 8), [cities]);

  if (randomCities.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <FadeInSection className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
            <Building2 className="h-3.5 w-3.5" />
            Cobertura nacional
          </div>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Profissionais por Cidade
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Encontre profissionais nas cidades com serviços ativos
          </p>
        </FadeInSection>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {randomCities.map((city, i) => {
            const gradient = stateColors[city.state] || 'from-primary/10 to-accent/5';
            return (
              <FadeInSection key={city.slug} delay={i * 0.05}>
                <Link
                  to={`/cidade/${city.slug}`}
                  className="group relative flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center shadow-card transition-all duration-300 hover:border-primary/40 hover:-translate-y-1 hover:shadow-card-hover overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent/10 to-accent/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md">
                    <MapPin className="h-5 w-5 text-accent" />
                  </div>
                  <span className="relative mt-2.5 font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">{city.name}</span>
                  <span className="relative text-[11px] text-muted-foreground font-medium">{city.state}</span>
                </Link>
              </FadeInSection>
            );
          })}
        </div>

        <FadeInSection delay={0.3} className="mt-6 text-center">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5 shadow-sm" asChild>
            <Link to="/cidades">Ver mais cidades <ChevronRight className="h-3 w-3" /></Link>
          </Button>
        </FadeInSection>
      </div>
    </section>
  );
};

export default CitiesSection;
