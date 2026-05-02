/**
 * Device fingerprint (open-source) — gerado SOMENTE quando o usuário
 * consentiu com a categoria "Funcional / Segurança" no banner LGPD.
 *
 * Uso típico:
 *   const fp = await getDeviceFingerprint();
 *   if (fp) await supabase.rpc("check_registration_block", { _device_fingerprint: fp, ... })
 *
 * Sem consentimento → retorna `null` e nenhum sinal é coletado.
 *
 * Cacheado em memória + sessionStorage para evitar re-cálculo a cada chamada.
 * Atrás de import dinâmico para não pesar no bundle inicial.
 */
import { getConsent } from "@/lib/cookieConsent";

const SS_KEY = "device_fp_v1";
let cached: string | null = null;

export async function getDeviceFingerprint(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const consent = getConsent();
  // Bloqueio LGPD: sem consentimento "Funcional" não geramos fingerprint.
  if (!consent || consent.functional !== true) return null;

  if (cached) return cached;
  try {
    const fromSession = sessionStorage.getItem(SS_KEY);
    if (fromSession) {
      cached = fromSession;
      return fromSession;
    }
  } catch {
    /* noop */
  }

  try {
    const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
    const agent = await FingerprintJS.load({ monitoring: false });
    const result = await agent.get();
    cached = result.visitorId || null;
    if (cached) {
      try {
        sessionStorage.setItem(SS_KEY, cached);
      } catch {
        /* noop */
      }
    }
    return cached;
  } catch {
    return null;
  }
}

/** Limpa o cache em memória/sessão. Útil em logout/exclusão de conta. */
export function clearDeviceFingerprintCache(): void {
  cached = null;
  try {
    sessionStorage.removeItem(SS_KEY);
  } catch {
    /* noop */
  }
}
