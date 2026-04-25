import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin, MessageCircle, User, Briefcase, Image as ImageIcon, Loader2 } from 'lucide-react';
import { generateProviderSlug, slugify } from '@/lib/slugify';
import { supabase } from '@/integrations/supabase/client';
import type { ProfileWizardData } from './types';

interface PublicProfilePreviewProps {
  data: ProfileWizardData;
  /** Slug salvo (se já existir). Caso ausente, geramos a partir do nome. */
  slug?: string;
  /** ID do usuário autenticado — usado para carregar serviços e portfólio reais (modo edit). */
  userId?: string;
}

interface ServiceRow {
  id: string;
  service_name: string;
  description: string;
  price: string | null;
}

interface MediaRow {
  id: string;
  public_url: string;
  blur_data_url: string | null;
}

/**
 * Pré-visualização compacta de como o profissional aparecerá em
 * /profissional/{slug}. Usada na última etapa do wizard como
 * "revisão visual" antes de concluir.
 *
 * Quando `userId` é fornecido (modo edit), carrega serviços ativos e
 * itens do portfólio do banco, espelhando o perfil público real.
 */
const PublicProfilePreview = ({ data, slug, userId }: PublicProfilePreviewProps) => {
  const computedSlug = useMemo(() => {
    if (slug) return slug;
    if (data.full_name && data.city) return generateProviderSlug(data.full_name, data.city);
    if (data.full_name) return slugify(data.full_name);
    return 'meu-perfil';
  }, [slug, data.full_name, data.city]);
  const previewUrl = `/profissional/${computedSlug}`;
  const initials = (data.full_name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const location = [data.city, data.state].filter(Boolean).join(' / ');

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // 1) Localiza o provider do usuário para buscar serviços vinculados.
        const { data: prov } = await supabase
          .from('providers')
          .select('id, user_ref')
          .eq('user_id', userId)
          .maybeSingle();

        if (prov?.id) {
          const { data: svcs } = await supabase
            .from('services')
            .select('id, service_name, description, price')
            .eq('provider_id', prov.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(6);
          if (!cancelled) setServices((svcs as ServiceRow[]) || []);
        }

        // 2) Portfólio: tenta por user_ref do provider; cai para entity_ref=userId.
        const userRef = prov?.user_ref;
        let mediaQ = supabase
          .from('media')
          .select('id, public_url, blur_data_url')
          .eq('is_active', true)
          .eq('entity_type', 'portfolio')
          .order('created_at', { ascending: false })
          .limit(6);
        if (userRef) mediaQ = mediaQ.eq('user_ref', userRef);
        else mediaQ = mediaQ.eq('entity_ref', userId);
        const { data: medias } = await mediaQ;
        if (!cancelled) setMedia((medias as MediaRow[]) || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Pré-visualização do perfil público
        </span>
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
        >
          {previewUrl} <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={data.full_name || 'Avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {initials || <User className="h-6 w-6" />}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-foreground truncate">
              {data.full_name || 'Seu nome aparecerá aqui'}
            </h3>
            {location && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {location}
              </p>
            )}
            {data.category && data.category !== 'all' && (
              <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {data.category}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4">
          {data.bio?.trim()
            ? data.bio
            : 'Sua bio aparecerá aqui — descreva sua experiência, especialidades e o que torna seu trabalho único.'}
        </p>

        {data.whatsapp && (
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            Contato via WhatsApp habilitado
          </div>
        )}

        {/* Serviços reais (modo edit) */}
        {userId && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Meus serviços
              </span>
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {services.length === 0 && !loading ? (
              <p className="text-[11px] text-muted-foreground">
                Você ainda não cadastrou serviços. Adicione na seção "Serviços" do dashboard.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {services.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-3 text-xs rounded-md border border-border bg-background px-2.5 py-1.5"
                  >
                    <span className="font-medium text-foreground truncate">{s.service_name}</span>
                    {s.price && (
                      <span className="shrink-0 text-muted-foreground">{s.price}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Portfólio real (modo edit) */}
        {userId && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Portfólio
              </span>
            </div>
            {media.length === 0 && !loading ? (
              <p className="text-[11px] text-muted-foreground">
                Sem fotos no portfólio ainda.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className="aspect-square rounded-md overflow-hidden bg-muted border border-border"
                  >
                    <img
                      src={m.public_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicProfilePreview;
