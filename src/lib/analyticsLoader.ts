/**
 * analyticsLoader — Google Analytics 4 / Tag Manager gerenciados 100% pelo painel
 * administrativo (tabela `site_settings`), sem variáveis de ambiente e sem deploy.
 *
 * Chaves lidas em `site_settings`:
 *  - `analytics_enabled`      → 'true' | 'false' (kill switch global)
 *  - `ga4_measurement_id`     → 'G-XXXXXXXXXX'
 *  - `gtm_container_id`       → 'GTM-XXXXXXX' (opcional)
 *
 * LGPD: o script só é injetado com Consent Mode v2 em modo `denied` por padrão;
 * o `consentBridge` faz o update quando o usuário aceita. O kill-switch oficial
 * `window['ga-disable-<ID>']` continua funcionando porque publicamos o ID em
 * `window.GA_MEASUREMENT_IDS`.
 */

export const GA4_ID_REGEX = /^G-[A-Z0-9]{6,12}$/;
export const GTM_ID_REGEX = /^GTM-[A-Z0-9]{4,10}$/;

export interface AnalyticsConfig {
  enabled: boolean;
  ga4Id: string;
  gtmId: string;
}

export function parseAnalyticsConfig(values: Record<string, string> | undefined): AnalyticsConfig {
  const ga4 = (values?.ga4_measurement_id || '').trim().toUpperCase();
  const gtm = (values?.gtm_container_id || '').trim().toUpperCase();
  return {
    enabled: values?.analytics_enabled === 'true',
    ga4Id: GA4_ID_REGEX.test(ga4) ? ga4 : '',
    gtmId: GTM_ID_REGEX.test(gtm) ? gtm : '',
  };
}

const loaded = new Set<string>();

function injectScript(src: string, id: string) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  s.id = id;
  document.head.appendChild(s);
}

function ensureGtag() {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== 'function') {
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer.push(args);
    };
  }
  return w.gtag as (...args: unknown[]) => void;
}

/** Injeta GA4/GTM conforme a config do admin. Idempotente. */
export function applyAnalyticsConfig(config: AnalyticsConfig) {
  if (typeof window === 'undefined' || !config.enabled) return;

  if (config.ga4Id && !loaded.has(config.ga4Id)) {
    loaded.add(config.ga4Id);
    const gtag = ensureGtag();
    // Consent Mode v2: nega por padrão; consentBridge libera após aceite.
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    const w = window as any;
    w.GA_MEASUREMENT_IDS = Array.from(new Set([...(w.GA_MEASUREMENT_IDS || []), config.ga4Id]));
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`, 'ga4-script');
    gtag('js', new Date());
    gtag('config', config.ga4Id, { send_page_view: true });
  }

  if (config.gtmId && !loaded.has(config.gtmId)) {
    loaded.add(config.gtmId);
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    injectScript(`https://www.googletagmanager.com/gtm.js?id=${config.gtmId}`, 'gtm-script');
  }
}

/** Page view em navegação SPA (gtag não rastreia troca de rota sozinho). */
export function trackAnalyticsPageView(path: string) {
  try {
    const w = window as any;
    if (typeof w.gtag === 'function') w.gtag('event', 'page_view', { page_path: path });
    if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: 'spa_page_view', page_path: path });
  } catch { /* analytics nunca quebra a navegação */ }
}

/** Evento de conversão (lead/WhatsApp/perfil) para medir origem SEO. */
export function trackAnalyticsConversion(name: string, params: Record<string, string> = {}) {
  try {
    const w = window as any;
    if (typeof w.gtag === 'function') w.gtag('event', name, params);
    if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event: name, ...params });
  } catch { /* noop */ }
}

/** Somente testes. */
export function __resetAnalyticsLoader() {
  loaded.clear();
}
