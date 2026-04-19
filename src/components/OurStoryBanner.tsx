import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OurStoryBannerProps {
  variant?: 'full' | 'compact';
}

const OurStoryBanner = forwardRef<HTMLDivElement, OurStoryBannerProps>(({ variant = 'full' }, _ref) => {
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5 p-4 text-center"
      >
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Heart className="h-4 w-4 text-destructive fill-destructive animate-pulse" />
          <span>
            Nascemos da luta contra a desvalorização profissional.{' '}
            <Link to="/sobre" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
              Conheça nossa história <ArrowRight className="h-3 w-3" />
            </Link>
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="py-12"
    >
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-accent/5 p-8 md:p-12 text-center">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative z-10">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10"
            >
              <Heart className="h-7 w-7 text-destructive fill-destructive" />
            </motion.div>

            <h3 className="font-display text-xl md:text-2xl font-bold text-foreground">
              Uma história de luta e superação
            </h3>
            <p className="mt-3 max-w-2xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed">
              Desde 2016 lutamos contra a exploração da mão de obra. Começamos com o{' '}
              <strong className="text-foreground">Encontre um Técnico</strong> — 300+ profissionais revoltados
              com a desvalorização. Sobrevivemos à pandemia, ao prejuízo e à incerteza. Hoje, o{' '}
              <strong className="text-foreground">Preciso de Um</strong> é a evolução sem limites: todas as
              áreas, todos os profissionais, zero exploração.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/sobre">
                  Conheça nossa história completa <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="hero-outline" size="lg">
                <Link to="/como-funciona">Como funciona</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
});

OurStoryBanner.displayName = 'OurStoryBanner';

export default OurStoryBanner;
