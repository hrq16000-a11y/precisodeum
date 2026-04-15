import { useMemo } from 'react';
import { DollarSign, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import FadeInSection from '@/components/FadeInSection';

// Fallback problem descriptions - used only when description field is empty
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

function getServiceProblem(name: string, slug: string, description?: string): string {
  // Use DB description first (admin-managed)
  if (description && description.trim()) return description;
  // Fallback to hardcoded map
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

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

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
    staleTime: 1000 * 60 * 15,
  });

  const displayed = useMemo(() => shuffle(services).slice(0, 6), [services]);

  if (isLoading) {
    return (
      <section className="py-10">
        <div className="container">
          <Skeleton className="mx-auto mb-6 h-7 w-48" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex gap-3 rounded-xl border border-border p-4">
                <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (displayed.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <FadeInSection className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Serviços mais procurados
          </div>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Precisa de Ajuda?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Problemas comuns que nossos profissionais resolvem
          </p>
        </FadeInSection>

        <motion.div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {displayed.map((s: any, i: number) => {
            const problem = getServiceProblem(s.name, s.slug, s.description);
            const basePrice = Number(s.min_price) || 0;
            const maxPrice = Math.round(basePrice * 1.8);
            const isFirst = i === 0;

            return (
              <motion.div key={s.id} variants={cardVariants}>
                <Link
                  to={`/servico/${s.slug}`}
                  className="group relative flex gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/30 overflow-hidden"
                >
                  {/* Gradient sweep on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-accent/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Badge "Mais procurado" for first item */}
                  {isFirst && (
                    <motion.span
                      className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <TrendingUp className="h-2.5 w-2.5" />
                      Mais procurado
                    </motion.span>
                  )}

                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/10 to-accent/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <CategoryIcon icon={s.icon || 'Wrench'} size={24} className="text-accent" />
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {problem}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {s.description || 'Visita técnica, diagnóstico e execução do serviço.'}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      {basePrice > 0 && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-accent" />
                          <span className="text-xs font-semibold text-accent">
                            R$ {basePrice.toFixed(0)} - R$ {maxPrice.toFixed(0)}
                          </span>
                        </div>
                      )}
                      <span className="flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5">
                        Ver profissionais <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default PopularServices;
