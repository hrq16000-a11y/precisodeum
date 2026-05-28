/**
 * buildPhaseProps — builders PUROS para as props visuais densas do
 * `OnboardingV2Shell` (PR 12 — UI Composition Finalization).
 *
 * REGRAS:
 *  - Funções 100% puras: sem hooks, sem refs, sem effects, sem storage,
 *    sem leitura de window, sem dispatch, sem telemetria.
 *  - Reduzem a verbosidade do `renderPhase()` no shell movendo apenas
 *    construção de objetos derivados (copy/encouragement/diagnostics).
 *  - Todo runtime (callbacks, persistência, navegação, tracking) continua
 *    no shell — estas helpers NÃO recebem nem retornam funções.
 *
 * Se algum builder começar a precisar de side-effects, ele NÃO pertence
 * aqui — mova para um hook dedicado.
 */
import type {
  OnboardingProfileData,
  OnboardingServiceData,
} from '@/components/onboarding/wizard/phases/v2/types';
import { phase2PhotosBlockCode } from '@/lib/wizardErrorCodes';

interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface EncouragementCopy {
  title: string;
  description: string;
  items: ChecklistItem[];
  nextStep: string;
  tone?: 'celebrate' | 'gentle';
}

export function buildPhase2ServiceEncouragement(
  service: OnboardingServiceData,
  photoCount: number,
): EncouragementCopy {
  const hasCategory = (service.category_ids?.length ?? 0) > 0;
  const hasName = !!(service.service_name || '').trim();
  const hasDesc = (service.description || '').trim().length >= 10;

  return {
    title: 'Você está a 3 passos do seu 1º anúncio',
    description:
      'Cadastre o serviço, capriche nos detalhes e adicione fotos — clientes da sua região já estão buscando.',
    items: [
      { label: `Serviço${hasName ? ' — pronto' : ''}`, done: hasName && hasCategory },
      { label: `Detalhes${hasDesc ? ' — pronto' : ''}`, done: hasDesc },
      { label: `Fotos${photoCount > 0 ? ` — ${photoCount}/5` : ''}`, done: photoCount > 0 },
    ],
    nextStep: !hasCategory
      ? 'Escolha a categoria do serviço.'
      : !hasName
        ? 'Dê um nome curto e claro ao serviço.'
        : !hasDesc
          ? 'Escreva uma descrição (mín. 10 caracteres).'
          : 'Tudo pronto — pode salvar e continuar.',
  };
}

export function buildPhase2DetailsEncouragement(
  service: OnboardingServiceData,
  photoCount: number,
): EncouragementCopy {
  const hasName = !!(service.service_name || '').trim();
  const hasCities = (service.cities_served?.length ?? 0) > 0;
  const hasHours = (service.working_hours || '').trim().length > 0;

  return {
    title: 'Detalhes vendem mais',
    description:
      'Anúncios com descrição e horário recebem até 3× mais contatos — você pode pular e voltar depois.',
    items: [
      { label: 'Serviço — pronto', done: hasName },
      {
        label: `Detalhes${hasCities && hasHours ? ' — completo' : ''}`,
        done: hasCities && hasHours,
      },
      { label: `Fotos${photoCount > 0 ? ` — ${photoCount}/5` : ''}`, done: photoCount > 0 },
    ],
    nextStep: !hasCities
      ? 'Adicione pelo menos 1 cidade onde você atende.'
      : !hasHours
        ? 'Defina seus horários de atendimento.'
        : 'Pode salvar e seguir para as fotos.',
  };
}

export function buildPhase2PhotosReadyEncouragement(
  service: OnboardingServiceData,
  photoCount: number,
): EncouragementCopy {
  return {
    tone: photoCount > 0 ? 'celebrate' : 'gentle',
    title:
      photoCount > 0
        ? `Mandou bem! ${photoCount} foto${photoCount > 1 ? 's' : ''} no ar`
        : 'Última etapa do circuito principal',
    description:
      'Fotos bem feitas viram cliques. Mesmo 1 foto já libera o selo de anúncio completo.',
    items: [
      { label: 'Serviço — pronto', done: true },
      { label: 'Detalhes — pronto', done: !!(service.description || '').trim() },
      { label: `Fotos — ${photoCount}/5`, done: photoCount > 0 },
    ],
    nextStep:
      photoCount === 0
        ? 'Suba pelo menos 1 foto ou pule por enquanto — você pode voltar depois.'
        : photoCount < 3
          ? 'Adicione mais fotos para destacar o anúncio (até 5).'
          : 'Tudo pronto! Pode concluir e celebrar.',
  };
}

export interface Phase2PhotosBlockedDiagnostics {
  reason: 'no_service' | 'no_session';
  missing: string[];
  blockCode: string;
}

/**
 * Calcula motivo + campos faltantes + código canônico de bloqueio para o
 * card `phase2_photos`. PURA — sem efeitos, sem telemetria, sem auto-retry.
 * O shell decide quando renderizar e cuida do tracking/recover.
 */
export function buildPhase2PhotosBlockedDiagnostics(input: {
  hasUser: boolean;
  service: OnboardingServiceData;
  profile: OnboardingProfileData;
}): Phase2PhotosBlockedDiagnostics {
  const reason: 'no_service' | 'no_session' = !input.hasUser ? 'no_session' : 'no_service';
  const missing: string[] = [];
  if (reason === 'no_service') {
    const hasCategory =
      (input.service.category_ids?.length || 0) > 0 ||
      !!input.profile.primary_category_id;
    const hasName = !!(input.service.service_name || '').trim();
    const hasDesc = ((input.service.description || '').trim().length) >= 10;
    const hasCity = !!(input.profile.city || '').trim();
    if (!hasCategory) missing.push('categoria do serviço');
    if (!hasName) missing.push('nome do serviço');
    if (!hasDesc) missing.push('descrição (mínimo 10 caracteres)');
    if (!hasCity) missing.push('cidade');
  }
  return { reason, missing, blockCode: phase2PhotosBlockCode(reason) };
}
