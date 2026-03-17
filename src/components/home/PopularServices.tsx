import { DollarSign, Tag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const PopularServices = () => {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['popular-services-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('popular_services' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as any[];
    },
  });

  if (isLoading) {
    return (
      <section className="py-10">
        <div className="container">
          <div className="mb-8 text-center">
            <Skeleton className="mx-auto h-8 w-48" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </div>
      </section>
    );
  }

  if (services.length === 0) return null;

  return (
    <section className="py-14">
      <div className="container">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Serviços Populares
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Os serviços mais procurados na plataforma
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s: any) => (
            <Link
              key={s.id}
              to={`/servico/${s.slug}`}
              className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <h3 className="font-display text-base font-bold text-foreground">{s.name}</h3>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="h-3.5 w-3.5 text-primary" />
                {s.category_name}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold text-accent">
                    A partir de R$ {Number(s.min_price).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PopularServices;
