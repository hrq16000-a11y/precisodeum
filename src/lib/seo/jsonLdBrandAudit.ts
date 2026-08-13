/**
 * JSON-LD Brand Audit — validação pura de consistência entre o JSON-LD
 * emitido pelas rotas SEO e o brand config ativo (`src/config/brand.ts`).
 *
 * Objetivo: garantir que, ao "remixar" o portal (outro domínio/nicho),
 * nenhuma rota continue emitindo URL, nome ou locale do domínio antigo.
 *
 * 100% puro: não toca no DOM e não depende de React.
 */

import { BRAND, BRAND_BASE_URL } from '@/config/brand';

export type JsonLdObject = Record<string, unknown>;

export interface JsonLdAuditIssue {
  severity: 'error' | 'warning';
  code:
    | 'missing_context'
    | 'missing_type'
    | 'foreign_domain'
    | 'relative_url'
    | 'brand_name_mismatch'
    | 'empty_payload'
    | 'missing_required_field';
  message: string;
  path?: string;
}

export interface JsonLdAuditResult {
  ok: boolean;
  issues: JsonLdAuditIssue[];
}

/** Campos mínimos exigidos por @type — o que o Google precisa para rich results. */
const REQUIRED_FIELDS: Record<string, string[]> = {
  Organization: ['name', 'url'],
  WebSite: ['name', 'url'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  ItemList: ['itemListElement'],
  ProfessionalService: ['name'],
  LocalBusiness: ['name'],
  Service: ['name'],
  Article: ['headline'],
};

const URL_KEYS = new Set(['url', 'item', '@id', 'sameAs', 'mainEntityOfPage']);

function walkUrls(node: unknown, path: string, out: Array<{ value: string; path: string }>) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkUrls(child, `${path}[${i}]`, out));
    return;
  }
  if (typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as JsonLdObject)) {
    const childPath = path ? `${path}.${key}` : key;
    if (typeof value === 'string' && URL_KEYS.has(key)) {
      out.push({ value, path: childPath });
    } else if (value && typeof value === 'object') {
      walkUrls(value, childPath, out);
    }
  }
}

export interface JsonLdAuditOptions {
  /** Base canônica esperada. Default: brand config. */
  baseUrl?: string;
  /** Nome de marca esperado. Default: brand config. */
  brandName?: string;
  /** Domínios externos aceitos (redes sociais, CDN de imagem, etc.). */
  allowedExternalHosts?: string[];
}

/**
 * Audita um único objeto JSON-LD contra o brand config.
 * Fail-closed: payload vazio ou sem @context/@type é erro.
 */
export function auditJsonLd(
  data: JsonLdObject | null | undefined,
  options: JsonLdAuditOptions = {},
): JsonLdAuditResult {
  const baseUrl = (options.baseUrl || BRAND_BASE_URL).replace(/\/+$/, '');
  const brandName = options.brandName || BRAND.name;
  const allowed = new Set(
    [new URL(baseUrl).host, ...(options.allowedExternalHosts || [])].map((h) => h.toLowerCase()),
  );
  const issues: JsonLdAuditIssue[] = [];

  if (!data || Object.keys(data).length === 0) {
    return { ok: false, issues: [{ severity: 'error', code: 'empty_payload', message: 'JSON-LD vazio.' }] };
  }

  if (data['@context'] !== 'https://schema.org') {
    issues.push({
      severity: 'error',
      code: 'missing_context',
      message: '@context deve ser "https://schema.org".',
    });
  }

  const type = data['@type'];
  if (typeof type !== 'string' || !type) {
    issues.push({ severity: 'error', code: 'missing_type', message: '@type ausente.' });
  } else {
    for (const field of REQUIRED_FIELDS[type] || []) {
      const value = data[field];
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);
      if (empty) {
        issues.push({
          severity: 'error',
          code: 'missing_required_field',
          message: `${type} exige o campo "${field}".`,
          path: field,
        });
      }
    }
  }

  const urls: Array<{ value: string; path: string }> = [];
  walkUrls(data, '', urls);
  for (const { value, path } of urls) {
    if (!value) continue;
    if (!/^https?:\/\//i.test(value)) {
      // @id pode ser um fragmento interno (#organization); URLs não.
      if (path.endsWith('@id') && value.startsWith('#')) continue;
      issues.push({
        severity: 'error',
        code: 'relative_url',
        message: `URL relativa em ${path}: "${value}". JSON-LD exige URL absoluta.`,
        path,
      });
      continue;
    }
    let host = '';
    try {
      host = new URL(value).host.toLowerCase();
    } catch {
      host = '';
    }
    if (host && !allowed.has(host)) {
      issues.push({
        severity: 'warning',
        code: 'foreign_domain',
        message: `URL fora do domínio da marca em ${path}: ${host}.`,
        path,
      });
    }
  }

  const name = data.name;
  if (
    (type === 'Organization' || type === 'WebSite') &&
    typeof name === 'string' &&
    !name.toLowerCase().includes(brandName.toLowerCase())
  ) {
    issues.push({
      severity: 'error',
      code: 'brand_name_mismatch',
      message: `name "${name}" não corresponde ao brand config "${brandName}".`,
      path: 'name',
    });
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues };
}

export interface RouteJsonLdInput {
  /** Rota auditada (ex.: /categoria/eletricista/em/curitiba). */
  path: string;
  /** JSON-LD emitidos por essa rota. */
  payloads: Array<JsonLdObject | null | undefined>;
}

export interface RouteJsonLdReport {
  path: string;
  ok: boolean;
  issues: JsonLdAuditIssue[];
  types: string[];
}

/** Audita várias rotas de uma vez — usado nos testes de contrato SEO. */
export function auditRoutesJsonLd(
  routes: RouteJsonLdInput[],
  options: JsonLdAuditOptions = {},
): { ok: boolean; reports: RouteJsonLdReport[] } {
  const reports = routes.map((route) => {
    const issues: JsonLdAuditIssue[] = [];
    const types: string[] = [];
    for (const payload of route.payloads) {
      const result = auditJsonLd(payload, options);
      issues.push(...result.issues);
      if (payload && typeof payload['@type'] === 'string') types.push(payload['@type'] as string);
    }
    return { path: route.path, ok: !issues.some((i) => i.severity === 'error'), issues, types };
  });
  return { ok: reports.every((r) => r.ok), reports };
}
