/**
 * locationConsistency — validação cidade-base vs área de atendimento.
 *
 * Garante que `providers.city` (cidade-base) seja sempre um MUNICÍPIO oficial,
 * nunca uma label regional ("Região Metropolitana de Curitiba", "Microrregião X").
 * Quando uma label regional é detectada na cidade-base, retornamos uma sugestão
 * para movê-la para a área de atendimento (`services.service_area`).
 *
 * Não acessa rede — usa apenas o filtro lexical de `geoReverseGeocode.isRegionalLabel`.
 */

import { isRegionalLabel } from '@/lib/geoReverseGeocode';

export type BaseCityIssueCode =
  | 'empty_city'
  | 'invalid_state'
  | 'regional_label_in_city'
  | 'neighborhood_equals_city'
  | 'regional_label_in_neighborhood';

export interface BaseCityIssue {
  code: BaseCityIssueCode;
  message: string;
  /** Sugestão de mover o valor problemático para a área de atendimento. */
  moveToServiceArea?: string;
}

function normalize(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Valida o par (cidade-base, UF, bairro) destinado a `providers`.
 * Retorna lista de problemas encontrados — vazio = OK.
 *
 * Regras:
 *  1. Cidade obrigatória.
 *  2. UF obrigatória, 2 letras.
 *  3. Cidade não pode ser label regional (ex.: "Região Metropolitana de Curitiba").
 *     → sugere mover para área de atendimento.
 *  4. Bairro não pode ser igual à cidade.
 *  5. Bairro não pode ser label regional.
 */
export function validateBaseCityVsServiceArea(input: {
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
}): BaseCityIssue[] {
  const issues: BaseCityIssue[] = [];
  const city = (input.city || '').trim();
  const uf = (input.state || '').trim().toUpperCase();
  const neighborhood = (input.neighborhood || '').trim();

  if (!city) {
    issues.push({ code: 'empty_city', message: 'Informe a cidade-base (município).' });
  }
  if (uf.length !== 2) {
    issues.push({ code: 'invalid_state', message: 'UF inválida — selecione um estado de 2 letras.' });
  }
  if (city && isRegionalLabel(city)) {
    issues.push({
      code: 'regional_label_in_city',
      message: `"${city}" é uma região, não um município. Use o município sede como cidade-base.`,
      moveToServiceArea: city,
    });
  }
  if (neighborhood && city && normalize(neighborhood) === normalize(city)) {
    issues.push({
      code: 'neighborhood_equals_city',
      message: 'O bairro não pode ser igual à cidade. Informe o bairro real (ex.: Centro, Boa Vista).',
    });
  }
  if (neighborhood && isRegionalLabel(neighborhood)) {
    issues.push({
      code: 'regional_label_in_neighborhood',
      message: `"${neighborhood}" é uma região, não um bairro.`,
      moveToServiceArea: neighborhood,
    });
  }
  return issues;
}

/** Atalho para verificar se há problemas bloqueadores (cidade vazia / UF / regional na cidade). */
export function hasBlockingBaseCityIssue(issues: BaseCityIssue[]): boolean {
  return issues.some((i) =>
    i.code === 'empty_city' ||
    i.code === 'invalid_state' ||
    i.code === 'regional_label_in_city',
  );
}
