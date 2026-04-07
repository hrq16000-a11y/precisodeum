import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, Users } from 'lucide-react';
import FadeInSection from '@/components/FadeInSection';

interface RealSearch {
  cat_name: string;
  cat_slug: string;
  city_name: string;
  city_slug: string;
  count: number;
}

const PopularSearches = () => {
  const [showAll, setShowAll] = useState(false);

  const { data: searches = [] } = useQuery({
    queryKey: ['popular-searches-real'],
    queryFn: async () => {
      // Get category+city combos that actually have approved providers
      const { data: providers } = await supabase
        .from('providers')
        .select('category_id, city, categories(name, slug)')
        .eq('status', 'approved')
        .is('deleted_at', null);

      if (!providers || providers.length === 0) return [];

      // Get cities for slug lookup
      const cityNames = [...new Set(providers.map((p: any) => p.city).filter(Boolean))];
      const { data: cities } = await supabase
        .from('cities')
        .select('name, slug')
        .in('name', cityNames);

      const cityMap: Record<string, string> = {};
      (cities || []).forEach((c: any) => { cityMap[c.name] = c.slug; });

      // Aggregate counts
      const combos: Record<string, RealSearch> = {};
      providers.forEach((p: any) => {
        const cat = p.categories as any;
        if (!cat?.name || !cat?.slug || !p.city || !cityMap[p.city]) return;
        const key = `${cat.slug}-${cityMap[p.city]}`;
        if (!combos[key]) {
          combos[key] = {
            cat_name: cat.name,
            cat_slug: cat.slug,
            city_name: p.city,
            city_slug: cityMap[p.city],
            count: 0,
          };
        }
        combos[key].count++;
      });

      // Sort by count desc
      return Object.values(combos).sort((a, b) => b.count - a.count);
    },
    staleTime: 1000 * 60 * 10,
  });

  const visible = showAll ? searches : searches.slice(0, 12);

  if (visible.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <FadeInSection className="mb-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground mb-3">
            <Search className="h-3.5 w-3.5" />
            Mais Procurados
          </div>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Buscas Populares
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Profissionais disponíveis por cidade</p>
        </FadeInSection>

        <FadeInSection delay={0.1}>
          <div className="flex flex-wrap justify-center gap-2">
            {visible.map((s, i) => (
              <Link
                key={`${s.cat_slug}-${s.city_slug}`}
                to={`/buscar?categoria=${s.cat_slug}&cidade=${s.city_slug}`}
                className="group rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground transition-all duration-300 hover:border-primary hover:text-primary hover:bg-primary/5 hover:shadow-sm hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="flex items-center gap-1.5">
                  <Search className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {s.cat_name} em {s.city_name}
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    <Users className="h-2.5 w-2.5" />{s.count}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </FadeInSection>

        {!showAll && searches.length > 12 && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(true)}
              className="text-xs gap-1 rounded-full"
            >
              <ChevronDown className="h-3 w-3" />
              Ver mais buscas ({searches.length - 12})
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularSearches;
