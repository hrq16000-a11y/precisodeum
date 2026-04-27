/**
 * Phase4Review — Tela de Revisão (Step final antes de 'done').
 *
 * IMPORTANTE: Esta tela é SOMENTE LEITURA + navegação.
 * O botão "Confirmar e Publicar" NÃO faz upserts — a persistência
 * já foi feita patch-a-patch nas fases anteriores. Isso evita o
 * erro 'tuple already modified'.
 *
 * Cada seção tem botão "Editar" que despacha GO_TO para a fase correspondente.
 */

import { CheckCircle2, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { OnboardingProfileData, OnboardingFirstServiceData, OnboardingPhase } from './types';

interface Phase4ReviewProps {
  profile: OnboardingProfileData;
  service: OnboardingFirstServiceData;
  saving?: boolean;
  onEdit: (phase: OnboardingPhase) => void;
  onConfirm: () => void;
}

function fmtDoc(kind: string, doc: string) {
  if (!doc) return null;
  const d = doc.replace(/\D/g, '');
  if (kind === 'pj' && d.length === 14) {
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }
  return doc;
}

interface SectionProps {
  title: string;
  editPhase: OnboardingPhase;
  onEdit: (p: OnboardingPhase) => void;
  children: React.ReactNode;
}

const Section = ({ title, editPhase, onEdit, children }: SectionProps) => (
  <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm">
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <button
        type="button"
        onClick={() => onEdit(editPhase)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <Pencil className="h-3 w-3" /> Editar
      </button>
    </div>
    <div className="space-y-1.5 text-sm text-foreground">{children}</div>
  </div>
);

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-right text-sm font-medium text-foreground">
      {value || <span className="text-muted-foreground italic">não informado</span>}
    </span>
  </div>
);

export const Phase4Review = ({ profile, service, saving, onEdit, onConfirm }: Phase4ReviewProps) => {
  const docFormatted = fmtDoc(profile.kind, profile.document);
  const cities = service.cities_served?.join(', ');
  const days = service.working_days?.join(', ');

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Revise antes de publicar</h2>
        <p className="text-sm text-muted-foreground">Tudo certo? Você pode editar qualquer seção.</p>
      </div>

      <Section title="Identidade" editPhase="phase1_contact" onEdit={onEdit}>
        <Row label="Nome" value={profile.full_name} />
        <Row label={profile.kind === 'pj' ? 'CNPJ' : 'CPF'} value={docFormatted} />
        <Row label="WhatsApp" value={profile.whatsapp} />
      </Section>

      <Section title="Serviço" editPhase="phase2_service" onEdit={onEdit}>
        <Row label="Categoria" value={service.service_name} />
        <Row
          label="Experiência"
          value={profile.years_experience != null ? `${profile.years_experience} ano(s)` : null}
        />
      </Section>

      <Section title="Logística" editPhase="phase2_details" onEdit={onEdit}>
        <Row label="Cidade base" value={[profile.city, profile.state].filter(Boolean).join(' - ')} />
        <Row label="Bairro" value={profile.neighborhood} />
        <Row label="Atende em" value={cities} />
        <Row label="Dias" value={days} />
        <Row label="Horário" value={service.working_hours} />
      </Section>

      <Section title="Perfil" editPhase="phase4_extras_a" onEdit={onEdit}>
        <Row label="Bio" value={profile.bio} />
        <Row
          label="Foto"
          value={profile.avatar_url ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> enviada
            </Badge>
          ) : null}
        />
        <Row label="Instagram" value={profile.instagram_url} />
        <Row label="Facebook" value={profile.facebook_url} />
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border bg-background/95 px-4 pt-3 pb-1 backdrop-blur-md">
        <Button
          onClick={onConfirm}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
        >
          {saving ? 'Publicando...' : 'Confirmar e Publicar'}
        </Button>
      </div>
    </div>
  );
};

export default Phase4Review;
