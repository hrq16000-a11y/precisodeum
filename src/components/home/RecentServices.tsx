import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface RecentService {
  id: string;
  service_name: string;
  service_area: string;
  created_at?: string;
  categories?: { name?: string; slug?: string; icon?: string } | null;
  provider?: { city?: string; state?: string } | null;
}

interface Props {
  services: RecentService[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const RecentServices = ({ services }: Props) => {
  const displayed = useMemo(() => shuffle(services).slice(0, 6), [services]);

  if (displayed.length === 0) return null;

  return (
    <section className="py-10">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6 text-center"
        >
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
            🆕 Novidades
          </span>
          <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">
            Serviços Recém-Cadastrados
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Profissionais que acabaram de publicar seus serviços
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {displayed.map((s) => {
            const location = s.provider?.city
              ? `${s.provider.city}${s.provider.state ? ` - ${s.provider.state}` : ''}`
              : s.service_area || 'Brasil';
            const catSlug = (s.categories as any)?.slug;
            const catIcon = (s.categories as any)?.icon || '🔧';
            const catName = (s.categories as any)?.name;
            const ago = timeAgo(s.created_at);

            const content = (
              <div className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 hover:border-primary/20 overflow-hidden">
                {/* Hover gradient */}
                <span className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-accent/5 transition-all duration-500" />
                {/* Shine sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ease-out" />
                
                <motion.span
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {catIcon}
                </motion.span>
                <div className="relative min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {s.service_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {location}
                    </span>
                    {ago && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {ago}
                        </span>
                      </>
                    )}
                  </div>
                  {catName && (
                    <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                      {catName}
                    </span>
                  )}
                </div>
              </div>
            );

            return (
              <motion.div key={s.id} variants={item}>
                {catSlug ? (
                  <Link to={`/categoria/${catSlug}`}>{content}</Link>
                ) : (
                  content
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-5 text-center"
        >
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" asChild>
            <Link to="/buscar">
              Ver Todos os Serviços
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default RecentServices;
