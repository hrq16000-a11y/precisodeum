/**
 * wizardSnapshotInputs — fonte única para enriquecer o payload do
 * `recordRegistrationSnapshotOnce` no clique Finalizar/Skip do Wizard.
 *
 * Por que existir:
 * - Centraliza a versão atual dos Termos (TERMS_VERSION) — quando atualizar
 *   os Termos, basta bumpar aqui em UM lugar.
 * - Lê velocity_mps + accuracy_m que o `useGeoCity` persiste no localStorage
 *   após o último GPS bem sucedido, sem acoplar o Shell ao hook do mapa.
 * - Robusto: nunca lança — sempre retorna `null` em ambiente sem storage.
 */

/** Versão atual dos Termos de Uso (formato AAAA.MM.DD para sort lexicográfico). */
export const TERMS_VERSION = '2026.05.02';

const VELOCITY_KEY = 'geo_velocity_mps';
const ACCURACY_KEY = 'geo_accuracy_m';

function readNumber(key: string): number | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage?.getItem(key);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Lê velocity_mps capturado pelo Geolocation API no último GPS. */
export function readVelocityMps(): number | null {
  return readNumber(VELOCITY_KEY);
}

/** Lê accuracy_m capturado pelo Geolocation API no último GPS. */
export function readAccuracyMeters(): number | null {
  return readNumber(ACCURACY_KEY);
}

/** Conjunto canônico de campos forenses para anexar ao snapshot final. */
export function getForensicSnapshotFields(): {
  velocity_mps: number | null;
  accuracy_m_geo: number | null;
  terms_version: string;
  terms_accepted: true;
} {
  return {
    velocity_mps: readVelocityMps(),
    accuracy_m_geo: readAccuracyMeters(),
    terms_version: TERMS_VERSION,
    terms_accepted: true,
  };
}
