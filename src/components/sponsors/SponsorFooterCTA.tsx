import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSettingValue } from '@/hooks/useSiteSettings';
import SponsorScarcityBadge from './SponsorScarcityBadge';

interface Props {
  city?: string;
  category?: string;
  className?: string;
}

/** Bottom CTA block encouraging businesses to become sponsors */
const SponsorFooterCTA = ({ city, category, className = '' }: Props) => {
  const navigate = useNavigate();
  const type = city ? 'city' : category ? 'category' : 'global';
  const contextValue = city || category;

  // Admin-managed values with sensible defaults
  const ctaTitle = useSettingValue('sponsor_cta_title') || 'Destaque sua empresa aqui';
  const ctaSubtitle = useSettingValue('sponsor_cta_subtitle') || 'Seja encontrado por milhares de clientes. Patrocinadores recebem leads diretos e posicionamento premium na plataforma.';
  const ctaButtonText = useSettingValue('sponsor_cta_button_text') || 'Quero ser patrocinador';
  const ctaLink = useSettingValue('sponsor_cta_link') || '/quero-ser-patrocinador';

  const handleClick = () => {
    if (ctaLink.startsWith('http')) {
      window.open(ctaLink, '_blank');
    } else {
      navigate(ctaLink);
    }
  };

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
            {ctaTitle}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {ctaSubtitle}
          </p>
          
          <SponsorScarcityBadge type={type} contextValue={contextValue} className="justify-center mt-4" />

          <Button
            size="lg"
            className="mt-6 gap-2 bg-primary hover:bg-primary/90"
            onClick={handleClick}
          >
            {ctaButtonText}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.section>
  );
};

export default SponsorFooterCTA;
