/**
 * Parser único para erros de integridade do trigger `guard_provider_activation`.
 *
 * O backend dispara `RAISE EXCEPTION ... USING ERRCODE = '22023'` com mensagens
 * canônicas:
 *   - PROVIDER_INCOMPLETE_NEIGHBORHOOD
 *   - PROVIDER_INCOMPLETE_CITY
 *   - PROVIDER_INCOMPLETE_COORDS
 *
 * Este módulo é a fonte ÚNICA de:
 *  1. Detecção (code === '22023' OU mensagem com prefixo PROVIDER_INCOMPLETE_)
 *  2. Mapeamento determinístico do "kind" (neighborhood | coords | city)
 *  3. Texto de toast (título + descrição)
 *  4. Nome do CustomEvent de foco para a UI ouvir
 *
 * Sem esse parser, regex eram duplicadas no BetModeShell e em testes.
 */

export type ProviderIntegrityKind = 'neighborhood' | 'coords' | 'city';

export interface ProviderIntegrityError {
  matched: true;
  kind: ProviderIntegrityKind;
  /** Mensagem canônica recebida do banco (preservada para logs). */
  rawMessage: string;
  /** Código SQLSTATE original. */
  rawCode: string | undefined;
  /** Texto curto para o toast.error / título de página. */
  title: string;
  /** Descrição mais longa, com instrução acionável. */
  description: string;
  /** CustomEvent que a UI deve disparar para focar o campo correto. */
  focusEvent: 'wizard:focus-neighborhood' | 'wizard:focus-gps' | 'wizard:focus-city';
  /** Label do CTA na página/feedback dedicado. */
  ctaLabel: string;
}

export interface NotProviderIntegrityError {
  matched: false;
}

const MAP: Record<ProviderIntegrityKind, Omit<ProviderIntegrityError, 'matched' | 'kind' | 'rawMessage' | 'rawCode'>> = {
  neighborhood: {
    title: 'Quase lá!',
    description:
      'Precisamos que você confirme o Bairro para ativar seu perfil no mapa.',
    focusEvent: 'wizard:focus-neighborhood',
    ctaLabel: 'Revisar Bairro',
  },
  coords: {
    title: 'Localização incompleta',
    description:
      'Não conseguimos detectar seu GPS. Toque em "Usar GPS preciso" e confirme.',
    focusEvent: 'wizard:focus-gps',
    ctaLabel: 'Tentar GPS novamente',
  },
  city: {
    title: 'Cidade-base obrigatória',
    description:
      'Confirme sua cidade-base para finalizar o cadastro.',
    focusEvent: 'wizard:focus-city',
    ctaLabel: 'Revisar Cidade',
  },
};

/**
 * Decide o `kind` a partir da mensagem canônica. Ordem importa:
 *  - NEIGHBORHOOD vence COORDS vence default (city).
 */
function classifyKind(msg: string): ProviderIntegrityKind {
  if (/NEIGHBORHOOD/i.test(msg)) return 'neighborhood';
  if (/COORDS|LAT|LNG|LONG/i.test(msg)) return 'coords';
  return 'city';
}

/**
 * Detecta se o erro veio do trigger `guard_provider_activation` (22023) e
 * retorna o pacote completo (texto + foco + CTA).
 *
 * Regras de detecção:
 *   - code === '22023', OU
 *   - mensagem casa /PROVIDER_INCOMPLETE_/i
 *
 * Qualquer outro erro retorna `{ matched: false }` para o caller seguir o fluxo
 * de fallback normal (insert puro, etc.).
 */
export function parseProviderIntegrityError(
  err: unknown,
): ProviderIntegrityError | NotProviderIntegrityError {
  if (!err || typeof err !== 'object') return { matched: false };
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  const codeStr = typeof code === 'string' ? code : undefined;
  const msgStr = typeof message === 'string' ? message : '';
  const matched = codeStr === '22023' || /PROVIDER_INCOMPLETE_/i.test(msgStr);
  if (!matched) return { matched: false };
  const kind = classifyKind(msgStr);
  return {
    matched: true,
    kind,
    rawMessage: msgStr,
    rawCode: codeStr,
    ...MAP[kind],
  };
}

/**
 * Helper de UI: dispara o CustomEvent de foco apropriado. Tolerante a SSR e a
 * navegadores antigos (silencia exceções).
 */
export function dispatchProviderIntegrityFocus(
  parsed: ProviderIntegrityError,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(parsed.focusEvent));
  } catch {
    /* noop — focus é nice-to-have, nunca quebra o fluxo */
  }
}
