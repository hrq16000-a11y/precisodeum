import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SponsorScarcityBadge from './SponsorScarcityBadge';

interface Props {
  city?: string;
  category?: string;
  className?: string;
}

/** Bottom CTA block encouraging businesses to become sponsors */
const SponsorFooterCTA = ({ city, category, className = '' }: Props) => {
  const type = city ? 'city' : category ? 'category' : 'global';
  const contextValue = city || category;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className={`py-8 ${className}`}
    >
      <div className="container">
        <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 border border-primary/10 p-6 md:p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-foreground">
            Destaque sua empresa aqui
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Seja encontrado por milhares de clientes. Patrocinadores recebem leads diretos e posicionamento premium na plataforma.
          </p>
          
          <SponsorScarcityBadge type={type} contextValue={contextValue} className="justify-center mt-4" />

          <Button
            size="lg"
            className="mt-6 gap-2 bg-primary hover:bg-primary/90"
            onClick={() => window.open('https://wa.me/5500000000000?text=Quero%20ser%20patrocinador', '_blank')}
          >
            Quero ser patrocinador
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.section>
  );
};

export default SponsorFooterCTA;
