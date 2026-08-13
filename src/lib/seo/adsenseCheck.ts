/**
 * Validação de integração AdSense por rota (puro, sem I/O).
 *
 * Regras conferidas no HTML servido:
 *  - <meta name="google-adsense-account" content="ca-pub-...">
 *  - <script ... pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-...>
 *  - client do script === client da meta
 *  - script carregado com async + crossorigin="anonymous"
 *  - ausência de blocos <ins class="adsbygoogle"> sem data-ad-client/slot
 */

export const ADSENSE_PUBLISHER_ID = "ca-pub-3762170279587706";

export type AdsenseIssueLevel = "error" | "warning";

export type AdsenseIssue = {
  code:
    | "meta_missing"
    | "meta_client_mismatch"
    | "script_missing"
    | "script_client_mismatch"
    | "script_not_async"
    | "script_missing_crossorigin"
    | "ins_without_client"
    | "ins_without_slot";
  level: AdsenseIssueLevel;
  message: string;
};

export type AdsenseRouteReport = {
  route: string;
  httpStatus: number | null;
  ok: boolean;
  metaClient: string | null;
  scriptClient: string | null;
  insBlocks: number;
  issues: AdsenseIssue[];
};

const META_RE =
  /<meta[^>]+name=["']google-adsense-account["'][^>]*content=["']([^"']+)["'][^>]*>/i;
const SCRIPT_RE =
  /<script([^>]*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*)>/i;
const CLIENT_IN_SRC_RE = /client=(ca-pub-[0-9]+)/i;
const INS_RE = /<ins\b[^>]*class=["'][^"']*adsbygoogle[^"']*["'][^>]*>/gi;

export function analyzeAdsenseHtml(
  route: string,
  html: string,
  httpStatus: number | null,
  expectedClient: string = ADSENSE_PUBLISHER_ID,
): AdsenseRouteReport {
  const issues: AdsenseIssue[] = [];

  const metaMatch = html.match(META_RE);
  const metaClient = metaMatch?.[1] ?? null;
  if (!metaClient) {
    issues.push({
      code: "meta_missing",
      level: "error",
      message: 'Meta "google-adsense-account" ausente no <head>.',
    });
  } else if (metaClient !== expectedClient) {
    issues.push({
      code: "meta_client_mismatch",
      level: "error",
      message: `Meta aponta para ${metaClient} (esperado ${expectedClient}).`,
    });
  }

  const scriptMatch = html.match(SCRIPT_RE);
  const scriptAttrs = scriptMatch?.[1] ?? "";
  const scriptClient = scriptAttrs.match(CLIENT_IN_SRC_RE)?.[1] ?? null;

  if (!scriptMatch) {
    issues.push({
      code: "script_missing",
      level: "error",
      message: "Script adsbygoogle.js não encontrado na rota.",
    });
  } else {
    if (scriptClient && scriptClient !== expectedClient) {
      issues.push({
        code: "script_client_mismatch",
        level: "error",
        message: `Script usa client ${scriptClient} (esperado ${expectedClient}).`,
      });
    }
    if (!/\basync\b/i.test(scriptAttrs)) {
      issues.push({
        code: "script_not_async",
        level: "warning",
        message: "Script AdSense sem atributo async (impacta LCP).",
      });
    }
    if (!/crossorigin=["']anonymous["']/i.test(scriptAttrs)) {
      issues.push({
        code: "script_missing_crossorigin",
        level: "warning",
        message: 'Script AdSense sem crossorigin="anonymous".',
      });
    }
  }

  const insMatches = html.match(INS_RE) ?? [];
  for (const ins of insMatches) {
    if (!/data-ad-client=/i.test(ins)) {
      issues.push({
        code: "ins_without_client",
        level: "error",
        message: "Bloco <ins class=adsbygoogle> sem data-ad-client.",
      });
    }
    if (!/data-ad-slot=/i.test(ins)) {
      issues.push({
        code: "ins_without_slot",
        level: "warning",
        message: "Bloco <ins class=adsbygoogle> sem data-ad-slot.",
      });
    }
  }

  return {
    route,
    httpStatus,
    ok: httpStatus === 200 && issues.every((i) => i.level !== "error"),
    metaClient,
    scriptClient,
    insBlocks: insMatches.length,
    issues,
  };
}

export function summarizeAdsenseReports(reports: AdsenseRouteReport[]) {
  const errors = reports.filter((r) => r.issues.some((i) => i.level === "error"));
  const warnings = reports.filter(
    (r) => !errors.includes(r) && r.issues.some((i) => i.level === "warning"),
  );
  return {
    total: reports.length,
    okCount: reports.filter((r) => r.ok && r.issues.length === 0).length,
    errorCount: errors.length,
    warningCount: warnings.length,
    routesWithErrors: errors.map((r) => r.route),
  };
}

/** Texto curto e acionável por código de erro do AdSense. */
export const ADSENSE_ISSUE_HINTS: Record<AdsenseIssue["code"], string> = {
  meta_missing:
    'Adicione <meta name="google-adsense-account"> no <head> desta rota (index.html ou head dinâmico).',
  meta_client_mismatch:
    "O publisher da meta tag difere do configurado. Padronize o ca-pub-* em todas as rotas.",
  script_missing:
    "O script adsbygoogle.js não está sendo servido nesta rota. Verifique CSP, bloqueio por prerender ou carregamento condicional.",
  script_client_mismatch:
    "O parâmetro client do script difere da meta tag. Corrija a URL do script.",
  script_not_async:
    "Carregue o script com async para não bloquear a renderização (impacta LCP).",
  script_missing_crossorigin:
    'Inclua crossorigin="anonymous" no script para o AdSense reportar erros corretamente.',
  ins_without_client:
    "Blocos <ins class=adsbygoogle> precisam de data-ad-client para renderizar anúncios.",
  ins_without_slot:
    "Blocos <ins class=adsbygoogle> sem data-ad-slot não preenchem — defina o slot no painel do AdSense.",
};

export type AdsenseRouteFailure = {
  route: string;
  httpStatus: number | null;
  level: AdsenseIssueLevel;
  errorCodes: AdsenseIssue["code"][];
  warningCodes: AdsenseIssue["code"][];
  issues: Array<AdsenseIssue & { hint: string }>;
  /** URL pública da rota (para abrir/inspecionar). */
  routeUrl: string;
  /** Rich Results / inspeção rápida da mesma URL. */
  diagnosticUrl: string;
};

/**
 * Resumo por rota apenas das rotas com falha (erro ou aviso),
 * com códigos de erro e links diretos de diagnóstico.
 */
export function summarizeAdsenseFailuresByRoute(
  reports: AdsenseRouteReport[],
  origin: string,
): AdsenseRouteFailure[] {
  const base = origin.replace(/\/+$/, "");
  return reports
    .filter((r) => r.issues.length > 0 || r.httpStatus !== 200)
    .map((r) => {
      const issues = r.issues.map((i) => ({ ...i, hint: ADSENSE_ISSUE_HINTS[i.code] ?? "" }));
      const errorCodes = issues.filter((i) => i.level === "error").map((i) => i.code);
      const warningCodes = issues.filter((i) => i.level === "warning").map((i) => i.code);
      const routeUrl = `${base}${r.route.startsWith("/") ? r.route : `/${r.route}`}`;
      return {
        route: r.route,
        httpStatus: r.httpStatus,
        level: errorCodes.length > 0 || r.httpStatus !== 200 ? "error" : "warning",
        errorCodes,
        warningCodes,
        issues,
        routeUrl,
        diagnosticUrl: `https://search.google.com/test/rich-results?url=${encodeURIComponent(routeUrl)}`,
      } as AdsenseRouteFailure;
    })
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === "error" ? -1 : 1;
      return b.errorCodes.length + b.warningCodes.length - (a.errorCodes.length + a.warningCodes.length);
    });
}
