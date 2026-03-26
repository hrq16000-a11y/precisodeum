import { useMemo } from 'react';
import { DollarSign, ArrowRight, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

// Map common services to relatable problem descriptions
const problemMap: Record<string, string> = {
  'eletricista': 'Tomada sem funcionar? Curto-circuito?',
  'encanador': 'Vazamento ou cano estourado?',
  'pintor': 'Paredes descascando ou manchadas?',
  'pedreiro': 'Precisa de reforma ou construção?',
  'marceneiro': 'Móveis sob medida ou reparo?',
  'serralheiro': 'Portão, grade ou estrutura metálica?',
  'ar-condicionado': 'Ar-condicionado sem gelar?',
  'desentupidora': 'Pia ou ralo entupido?',
  'limpeza': 'Precisa de faxina profissional?',
  'mudanca': 'Vai se mudar? Precisa de ajuda?',
  'jardineiro': 'Jardim precisando de cuidados?',
  'mecanico': 'Carro com problema mecânico?',
  'faz-tudo': 'Serviço rápido em casa?',
  'tecnico': 'Equipamento com defeito?',
  'chuveiro': 'Chuveiro queimou ou sem pressão?',
};

function getServiceProblem(name: string, slug: string): string {
  const lower = slug.toLowerCase();
  for (const [key, problem] of Object.entries(problemMap)) {
    if (lower.includes(key)) return problem;
  }
  return `Precisa de ${name.toLowerCase()}?`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PopularServices = () => {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['popular-services-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('popular_services' as any)
        .select('id, name, slug, icon, category_name, min_price, description')
        .eq('active', true)
        .order('display_order');
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Show max 4, randomized
  const displayed = useMemo(() => shuffle(services).slice(0, 4), [services]);

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="container">
          <Skeleton className="mx-auto mb-6 h-7 w-48" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        </div>
      </section>
    );
  }

  if (displayed.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container">
        <div className="mb-6 text-center">
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Precisa de Ajuda?
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Problemas comuns que nossos profissionais resolvem
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {displayed.map((s: any) => {
            const problem = getServiceProblem(s.name, s.slug);
            // Add 30-50% margin for displayed price range
            const basePrice = Number(s.min_price) || 0;
            const maxPrice = Math.round(basePrice * 1.8);

            return (
              <Link
                key={s.id}
                to={`/servico/${s.slug}`}
                className="group flex gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xl">
                  {s.icon || '🔧'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {problem}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {s.description || `Visita técnica, diagnóstico e execução do serviço.`}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-accent" />
                      <span className="text-xs font-semibold text-accent">
                        R$ {basePrice.toFixed(0)} - R$ {maxPrice.toFixed(0)}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Encontrar profissional <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PopularServices;
