/**
 * RelatedProvidersSection — extraído de ProviderProfile.tsx.
 *
 * Dumb component: recebe a lista pré-processada de `relatedProviders` e os
 * metadados de categoria/tema. Nenhum fetch aqui — a query continua no
 * orquestrador. Lazy load via React.lazy no consumidor.
 */
import { Link } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Star, Users, UserRound } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { avatarLarge } from '@/lib/imageOptimizer';
import { formatCityState } from '@/lib/locationFormat';
import { THEME_CLASSES, type ThemeConfig } from './theme';

const fadeUp = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export interface RelatedProvidersSectionProps {
  relatedProviders: any[];
  category: string;
  categorySlug?: string;
  themeClasses?: ThemeConfig;
}

const RelatedProvidersSection = ({
  relatedProviders,
  category,
  categorySlug,
  themeClasses,
}: RelatedProvidersSectionProps) => {
  const tc = themeClasses || THEME_CLASSES.default;
  if (!relatedProviders || relatedProviders.length === 0) return null;

  return (
    <motion.div className="mt-8" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}>
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
          <Users className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>
            {category ? `Outros profissionais de ${category}` : 'Profissionais Relacionados'}
          </h2>
          <p className="text-xs text-muted-foreground">Veja mais opções na mesma área</p>
        </div>
      </div>
      <motion.div className="grid grid-cols-2 gap-3 sm:grid-cols-3" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        {relatedProviders.map((rp: any) => {
          const rpName = rp.profiles?.full_name || rp.business_name || 'Profissional';
          const rpAvatar = avatarLarge(rp.profiles?.avatar_url || rp.photo_url);
          const rpCategory = (rp.categories as any)?.name || '';
          const rpCatIcon = (rp.categories as any)?.icon || '';
          return (
            <motion.div key={rp.id} variants={scaleIn} whileHover={{ y: -6 }} transition={{ duration: 0.25 }}>
              <Link
                to={`/profissional/${rp.slug}`}
                className={`group block p-4 transition-all hover:shadow-xl hover:border-accent/30 ${tc.card} relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative flex flex-col items-center text-center gap-2.5">
                  <div className="relative">
                    <Avatar className="h-16 w-16 rounded-xl ring-2 ring-border group-hover:ring-accent/30 transition-all shadow-md">
                      <AvatarImage src={rpAvatar || undefined} alt={rpName} className="rounded-xl" />
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 shadow-inner">
                        <UserRound className="w-1/2 h-1/2 text-slate-300" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-sm font-semibold text-foreground truncate">{rpName}</p>
                    {rpCategory && (
                      <p className="text-[11px] text-accent truncate flex items-center justify-center gap-0.5">
                        <CategoryIcon icon={rpCatIcon} size={12} className="text-accent" /> {rpCategory}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      <MapPin className="inline h-3 w-3 mr-0.5" />{formatCityState(rp.city, rp.state)}
                    </p>
                    {rp.rating_avg > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1.5">
                        <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                        <span className="text-xs font-semibold text-foreground">{Number(rp.rating_avg).toFixed(1)}</span>
                        {rp.review_count > 0 && (
                          <span className="text-[10px] text-muted-foreground">({rp.review_count})</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-accent font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver perfil <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {categorySlug && (
        <motion.div className="mt-4 text-center" variants={fadeUp}>
          <Link
            to={`/categoria/${categorySlug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Ver todos os profissionais de {category}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
};

export default RelatedProvidersSection;
