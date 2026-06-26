/**
 * ServicesSection — extraído de ProviderProfile.tsx para lazy load.
 *
 * Contém o `ServicesList` (cartão "Serviços oferecidos") + o
 * `ServiceDetailDialog` (modal com galeria/descrição/CTA WhatsApp).
 *
 * Dumb components: recebem tudo via props. Toda lógica de fetch e estado
 * continua no orquestrador `ProviderProfile`. JSX/classes Tailwind copiados
 * literalmente para preservar o snapshot visual.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Briefcase,
  Clock,
  DollarSign,
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  Youtube,
} from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  serviceImageThumb,
  isYouTubeUrl,
  getYouTubeEmbedUrl,
} from '@/lib/imageOptimizer';
import { handleImageError } from '@/lib/imageResolver';
import { whatsappLink } from '@/lib/whatsapp';
import { formatLocationString } from '@/lib/normalize';
import { supabase } from '@/integrations/supabase/client';
import { THEME_CLASSES, type ThemeConfig } from './theme';

/* ── Helpers de tracking (espelho 1:1 do que vive no orquestrador) ── */
type ContactCtaOrigin = 'principal' | 'sticky' | 'flutuante' | 'servico';

const getLeadSource = () => {
  if (typeof window === 'undefined') return 'direto';
  const params = new URLSearchParams(window.location.search);
  const source = (params.get('origem') || params.get('utm_source') || '').toLowerCase();
  if (source.includes('busca') || document.referrer.includes('/buscar')) return 'busca';
  if (source.includes('categoria') || document.referrer.includes('/categoria/')) return 'categoria';
  return 'direto';
};

const trackContactClick = (
  providerId: string,
  contactType: 'whatsapp' | 'phone',
  pagePath: string,
  serviceName?: string,
  ctaOrigin: ContactCtaOrigin = 'principal',
) => {
  try {
    (supabase.rpc as any)('log_contact_click', {
      _provider_id: providerId,
      _contact_type: contactType,
      _page_path: pagePath,
      _visitor_id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    }).then(() => {});
  } catch { /* silent */ }
  try {
    (supabase.rpc as any)('log_provider_public_event', {
      provider_id: providerId,
      event_action: contactType === 'whatsapp' ? 'whatsapp_click' : 'phone_click',
      page_path: pagePath,
      service_name: serviceName || null,
      source_marker: getLeadSource(),
      cta_origin: ctaOrigin,
    }).then(() => {});
  } catch { /* silent */ }
  try {
    (supabase.rpc as any)('register_click_lead', {
      _provider_id: providerId,
      _contact_kind: contactType,
      _service_needed: serviceName || null,
      _lead_context: {
        page_path: pagePath,
        cta_origin: ctaOrigin,
        source_marker: getLeadSource(),
      },
    }).then(() => {});
  } catch { /* silent */ }
};

/* ── Service Detail Dialog ── */
const ServiceDetailDialog = ({
  service,
  open,
  onClose,
  whatsapp,
  ctaWhatsappText,
  accentBg,
  onImageClick,
  providerId,
}: {
  service: any;
  open: boolean;
  onClose: () => void;
  whatsapp: string;
  ctaWhatsappText?: string;
  accentBg?: string;
  onImageClick?: (images: string[], index: number) => void;
  providerId?: string;
}) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">{service.service_name}</DialogTitle>
      </DialogHeader>
      {service.serviceImages?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 md:grid md:grid-cols-2 md:overflow-visible md:snap-none" style={{ touchAction: 'pan-x' }}>
          {service.serviceImages.map((img: any, idx: number) => (
            <motion.div
              key={img.id}
              className="aspect-[4/3] min-w-[75%] flex-shrink-0 snap-center cursor-pointer overflow-hidden rounded-lg border border-border md:min-w-0"
              onClick={() => onImageClick?.(service.serviceImages.map((i: any) => i.image_url), idx)}
              whileHover={{ scale: 1.03 }}
            >
              <img src={serviceImageThumb(img.image_url)} alt="Foto do serviço" className="h-full w-full object-cover" loading="lazy" onError={handleImageError} />
            </motion.div>
          ))}
        </div>
      )}
      {service.serviceCategories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {service.serviceCategories.map((cat: any, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
              <CategoryIcon icon={cat.icon} size={12} className="text-accent" /> {cat.name}
            </span>
          ))}
        </div>
      )}
      {service.description && <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>}
      {(service.instagram_url || service.facebook_url || service.youtube_url) && (
        <div className="flex items-center gap-2">
          {service.instagram_url && (
            <a href={service.instagram_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all">
              <Instagram className="h-4 w-4" />
            </a>
          )}
          {service.facebook_url && (
            <a href={service.facebook_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all">
              <Facebook className="h-4 w-4" />
            </a>
          )}
          {service.youtube_url && (
            <a href={service.youtube_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-all">
              <Youtube className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
      {service.youtube_url && isYouTubeUrl(service.youtube_url) && (
        <div className="aspect-video rounded-lg overflow-hidden border border-border">
          <iframe
            src={getYouTubeEmbedUrl(service.youtube_url)}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {service.price && <span className="inline-flex items-center gap-1 font-semibold text-foreground"><DollarSign className="h-3.5 w-3.5 text-accent" /> {service.price}</span>}
        {service.service_area && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-accent" /> {formatLocationString(service.service_area)}</span>}
        {service.working_hours && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-accent" /> {service.working_hours}</span>}
      </div>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button variant="accent" className="w-full gap-2" asChild style={accentBg ? { backgroundColor: accentBg } : undefined}>
          <a href={whatsappLink(whatsapp || '', `Olá! Vi o serviço "${service.service_name}" no Preciso de um e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer" onClick={() => providerId && trackContactClick(providerId, 'whatsapp', window.location.pathname, service.service_name, 'servico')}>
            <MessageCircle className="h-4 w-4" /> {ctaWhatsappText || 'Chamar no WhatsApp'}
          </a>
        </Button>
      </motion.div>
    </DialogContent>
  </Dialog>
);

/* ── Services List with popup ── */
export interface ServicesSectionProps {
  services: any[];
  whatsapp: string;
  providerName: string;
  providerCity: string;
  ctaWhatsappText?: string;
  accentBg?: string;
  themeClasses?: ThemeConfig;
  onImageClick?: (images: string[], index: number) => void;
  providerId?: string;
}

const ServicesSection = ({
  services,
  whatsapp,
  ctaWhatsappText,
  accentBg,
  themeClasses,
  onImageClick,
  providerId,
}: ServicesSectionProps) => {
  const [selected, setSelected] = useState<any | null>(null);
  const tc = themeClasses || THEME_CLASSES.default;

  return (
    <>
      <motion.div className={`mt-6 ${tc.section} overflow-hidden`} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } }} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Briefcase className="h-4 w-4 text-accent" />
          </div>
          <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Serviços oferecidos</h2>
          {services.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {services.length} {services.length === 1 ? 'serviço' : 'serviços'}
            </span>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {services.map((s: any, idx: number) => (
            <motion.button
              key={s.id}
              onClick={() => setSelected(s)}
              className="w-full text-left rounded-xl border border-border p-4 transition-all hover:border-accent/30 hover:shadow-md group"
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              whileHover={{ x: 4 }}
            >
              <div className="flex gap-3">
                {s.serviceImages?.length > 0 && (
                  <div className="shrink-0 h-20 w-20 overflow-hidden rounded-lg border border-border shadow-sm">
                    <img
                      src={serviceImageThumb(s.serviceImages[0].image_url)}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={handleImageError}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">{s.service_name}</h3>
                  {s.serviceCategories?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.serviceCategories.map((cat: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          <CategoryIcon icon={cat.icon} size={10} className="text-accent" /> {cat.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.description && <p className="mt-1 line-clamp-2 text-xs text-foreground/70">{s.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {s.price && <span className="inline-flex items-center gap-0.5 font-medium text-foreground"><DollarSign className="h-3 w-3 text-accent" /> {s.price}</span>}
                    {s.service_area && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3 text-accent" /> {formatLocationString(s.service_area)}</span>}
                    {(s.instagram_url || s.facebook_url || s.youtube_url) && (
                      <span className="flex items-center gap-1">
                        {s.instagram_url && <Instagram className="h-3 w-3 text-accent" />}
                        {s.facebook_url && <Facebook className="h-3 w-3 text-accent" />}
                        {s.youtube_url && <Youtube className="h-3 w-3 text-accent" />}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0" />
              </div>
              {s.serviceImages?.length > 1 && (
                <div className="mt-2 flex gap-1.5 overflow-hidden pl-[calc(5rem+0.75rem)]">
                  {s.serviceImages.slice(1, 4).map((img: any) => (
                    <div key={img.id} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                      <img src={serviceImageThumb(img.image_url)} alt="" aria-hidden="true" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={handleImageError} />
                    </div>
                  ))}
                  {s.serviceImages.length > 4 && (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-medium text-muted-foreground">+{s.serviceImages.length - 4}</span>
                  )}
                </div>
              )}
            </motion.button>
          ))}
          {services.length === 0 && (
            <div className="text-center py-6 space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
            </div>
          )}
        </div>
      </motion.div>
      {selected && (
        <ServiceDetailDialog service={selected} open={!!selected} onClose={() => setSelected(null)} whatsapp={whatsapp} ctaWhatsappText={ctaWhatsappText} accentBg={accentBg} onImageClick={onImageClick} providerId={providerId} />
      )}
    </>
  );
};

export default ServicesSection;
