import { ExternalLink, MapPin, MessageCircle, User } from 'lucide-react';
import { slugify } from '@/lib/slugify';
import type { ProfileWizardData } from './types';

interface PublicProfilePreviewProps {
  data: ProfileWizardData;
  /** Slug salvo (se já existir). Caso ausente, geramos a partir do nome. */
  slug?: string;
}

/**
 * Pré-visualização compacta de como o profissional aparecerá em
 * /profissional/{slug}. Usada na última etapa do wizard como
 * "revisão visual" antes de concluir.
 *
 * Não consulta backend — projeta o estado atual do formulário.
 */
const PublicProfilePreview = ({ data, slug }: PublicProfilePreviewProps) => {
  const computedSlug = slug || (data.full_name ? slugify(data.full_name) : 'meu-perfil');
  const previewUrl = `/profissional/${computedSlug}`;
  const initials = (data.full_name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const location = [data.city, data.state].filter(Boolean).join(' / ');

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
      </div>
    </div>
  );
};

export default PublicProfilePreview;
