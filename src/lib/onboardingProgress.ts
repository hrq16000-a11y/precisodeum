/**
 * onboardingProgress — derivação pura de "o que falta" no wizard.
 *
 * Usada por:
 *  - `SaveLaterDialog` (resumo no modal de "Salvar e continuar mais tarde")
 *  - `/cadastro/retomar` (tela de recuperação)
 *  - WhatsApp prefilled message (contexto pro consultor)
 *
 * Nada de side-effects: recebe o snapshot do reducer (state.profile + state.service
 * + state.phase + state.firstServiceId) e devolve etapas, % de progresso e
 * próximo passo recomendado.
 */

import type { OnboardingState, OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';
import type { UnifiedPhase } from '@/components/onboarding/wizard/wizardReducer';

export interface ProgressItem {
  /** Identificador estável (usado em telemetria + key React). */
  id: string;
  /** Rótulo exibido ao usuário. */
  label: string;
  /** True se a etapa já foi cumprida. */
  done: boolean;
  /** Fase do reducer associada — usada para o "atalho retomar".
   *  Aceita `OnboardingPhase` (V2) ou `UnifiedPhase` (main_*). */
  phase: OnboardingPhase | UnifiedPhase;
}

export interface OnboardingProgressSummary {
  items: ProgressItem[];
  completed: number;
  total: number;
  /** 0..1 — útil pra Progress component. */
  ratio: number;
  /** Próxima fase pendente (ou a atual se nada falta). */
  nextPhase: OnboardingPhase | UnifiedPhase;
  /** Próximo item pendente (mesma referência de `items`) ou `null` se 100%. */
  nextItem: ProgressItem | null;
  /** Categoria principal escolhida (id) — útil pra contexto WhatsApp. */
  primaryCategoryId: string | null;
  /** Cidade principal — útil pra contexto WhatsApp. */
  city: string | null;
  /** UF — útil pra contexto WhatsApp. */
  state: string | null;
}

const has = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

/**
 * Calcula resumo de progresso a partir do estado do wizard (V2/unified).
 * Não confia em `state.phase` para "completude" — usa os dados reais do payload.
 */
export function computeOnboardingProgress(
  state: Pick<OnboardingState, 'profile' | 'service' | 'phase' | 'firstServiceId'>,
): OnboardingProgressSummary {
  const { profile, service, firstServiceId } = state;

  const items: ProgressItem[] = [
    {
      id: 'name_whatsapp',
      label: 'Nome e WhatsApp',
      done: has(profile.full_name) && has(profile.whatsapp),
      phase: 'main_contact',
    },
    {
      id: 'location',
      label: 'Cidade e estado',
      done: has(profile.city) && has(profile.state),
      phase: 'main_location',
    },
    {
      id: 'category',
      label: 'Categoria do serviço',
      done: has(profile.primary_category_id) || has(service.category_ids),
      phase: 'phase2_service',
    },
    {
      id: 'service_published',
      label: 'Primeiro serviço publicado',
      done: has(firstServiceId),
      phase: 'phase2_details',
    },
    {
      id: 'service_photos',
      label: 'Fotos do serviço (recomendado)',
      done: false, // calculado abaixo se houver dados
      phase: 'phase2_photos',
    },
    {
      id: 'avatar',
      label: 'Foto de perfil',
      done: has(profile.avatar_url),
      phase: 'phase4_avatar',
    },
    {
      id: 'document',
      label: 'CPF ou CNPJ (opcional)',
      done: has(profile.document),
      phase: 'phase4_document',
    },
    {
      id: 'bio',
      label: 'Bio profissional (opcional)',
      done: has(profile.bio),
      phase: 'phase4_extras_a',
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const nextItem = items.find((i) => !i.done) ?? null;
  const nextPhase = nextItem?.phase ?? state.phase;

  return {
    items,
    completed,
    total,
    ratio: total === 0 ? 0 : completed / total,
    nextPhase,
    nextItem,
    primaryCategoryId: profile.primary_category_id ?? service.category_ids?.[0] ?? null,
    city: profile.city || service.cities_served?.[0] || null,
    state: profile.state || null,
  };
}

/**
 * Mensagem WhatsApp pro consultor com contexto rico (categoria/cidade/etapa).
 * Mantém o tom do exit-intent mas adiciona o "estado" do usuário pra que o
 * atendente já saiba onde ele travou e em que cidade/categoria atua.
 *
 * NÃO inclui PII sensível (nome/whatsapp/documento) — só o que ajuda o
 * atendente a continuar a conversa. Nome/whatsapp já vêm do próprio canal.
 */
export interface WhatsappContextOptions {
  /** Nome humanizado da categoria (resolvido fora — aqui usamos o id como fallback). */
  categoryLabel?: string | null;
  /** Cidade exibível. */
  city?: string | null;
  /** UF (2 letras). */
  state?: string | null;
  /** Etapa em que o usuário está travado (string já humanizada). */
  stuckOnLabel?: string | null;
  /** Tipo de usuário — muda o prefixo da mensagem. */
  intent?: 'client' | 'professional' | 'rh' | 'unknown';
}

export function buildWhatsappContextMessage(opts: WhatsappContextOptions): string {
  const { categoryLabel, city, state, stuckOnLabel, intent } = opts;
  const isClient = intent === 'client';
  const lines: string[] = [];

  lines.push(
    isClient
      ? 'Olá! Estou em precisodeumprofissional.com.br procurando um profissional e gostaria de ajuda.'
      : 'Olá! Estou cadastrando meu perfil em precisodeumprofissional.com.br e gostaria de ajuda do suporte.',
  );

  const ctx: string[] = [];
  if (categoryLabel) ctx.push(`Categoria: ${categoryLabel}`);
  if (city || state) ctx.push(`Cidade: ${[city, state].filter(Boolean).join('/')}`);
  if (stuckOnLabel) ctx.push(`Etapa atual: ${stuckOnLabel}`);

  if (ctx.length) {
    lines.push('');
    lines.push('Contexto:');
    for (const c of ctx) lines.push(`- ${c}`);
  }

  return lines.join('\n');
}
