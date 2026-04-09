import { motion } from 'framer-motion';
import { BadgeCheck, ExternalLink, MessageCircle } from 'lucide-react';
import { SponsorFull } from '@/hooks/useSponsors';
import { Button } from '@/components/ui/button';

interface Props {
  sponsor: SponsorFull;
  compact?: boolean;
  /** Optional centralized click tracker from parent hook */
  onClickTrack?: (id: string) => void;
}

const SponsorPremiumCard = ({ sponsor, compact = false, onClickTrack }: Props) => {
  const handleClick = () => {
    onClickTrack?.(sponsor.id);
  };

  const whatsappUrl = sponsor.whatsapp
    ? `https://wa.me/${sponsor.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Vi vocês na plataforma Preciso de um.')}`
    : null;

  const displayName = sponsor.company_name || sponsor.title;
  const logo = sponsor.logo_url || sponsor.image_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      whileHover={{ y: -3, boxShadow: '0 12px 40px -8px hsl(var(--primary) / 0.15)' }}
      className="relative rounded-2xl border border-primary/20 bg-card p-4 shadow-card overflow-hidden group"
    >
      {/* Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5">
        <BadgeCheck className="h-3 w-3 text-primary icon-interactive" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          {sponsor.badge_type || 'Patrocinado'}
        </span>
      </div>

      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary/50" />

      <div className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col items-center text-center gap-3'}`}>
        {/* Logo */}
        {logo && (
          <div className={`${compact ? 'w-14 h-14' : 'w-20 h-20'} rounded-xl bg-muted/30 p-2 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
            <img
              src={logo}
              alt={displayName}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
        )}

        <div className={compact ? 'flex-1 min-w-0' : ''}>
          <h3 className={`font-bold text-foreground ${compact ? 'text-sm' : 'text-base'} truncate`}>
            {displayName}
          </h3>
          {sponsor.short_description && (
            <p className={`text-muted-foreground mt-0.5 line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
              {sponsor.short_description}
            </p>
          )}
        </div>
      </div>

      {/* CTA Buttons */}
      <div className={`flex gap-2 ${compact ? 'mt-3' : 'mt-4'}`}>
        {whatsappUrl && (
          <Button
            asChild
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            onClick={handleClick}
          >
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5 icon-cta" />
              WhatsApp
            </a>
          </Button>
        )}
        {(sponsor.external_link || sponsor.link_url) && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="flex-1 text-xs gap-1.5"
            onClick={handleClick}
          >
            <a href={sponsor.external_link || sponsor.link_url || '#'} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 icon-cta" />
              Ver mais
            </a>
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default SponsorPremiumCard;
