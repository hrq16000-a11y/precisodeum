/**
 * Rich Results Validator — valida se o JSON-LD renderizado por cada rota SEO
 * é elegível para rich results no Google.
 *
 * Vai além do `jsonLdBrandAudit` (que checa marca/domínio): aqui olhamos os
 * requisitos DE ELEGIBILIDADE por tipo (campos obrigatórios + recomendados +
 * limites do Google) e produzimos um log de discrepâncias POR PÁGINA.
 *
 * 100% puro: sem DOM, sem rede. Pode rodar em teste, script de build e CI.
 */

import { auditJsonLd, type JsonLdObject, type JsonLdAuditOptions } from './jsonLdBrandAudit';

export type RichResultType =
  | 'Organization'
  | 'WebSite'
  | 'BreadcrumbList'
  | 'FAQPage'
  | 'ItemList'
  | 'LocalBusiness'
  | 'ProfessionalService'
  | 'Service'
  | 'Article'
  | 'Product'
  | 'Review';

export interface RichResultRule {
  /** Campos sem os quais o Google NÃO exibe rich result. */
  required: string[];
  /** Campos que aumentam elegibilidade/qualidade (geram warning). */
  recommended: string[];
  /** Nº máximo de itens da coleção principal (0 = sem limite). */
  maxItems?: number;
  /** Chave da coleção principal, quando houver. */
  collectionKey?: string;
}

/** Requisitos por tipo, alinhados à documentação de rich results do Google. */
export const RICH_RESULT_RULES: Record<RichResultType, RichResultRule> = {
  Organization: { required: ['name', 'url'], recommended: ['logo', 'sameAs'] },
  WebSite: { required: ['name', 'url'], recommended: ['potentialAction'] },
  BreadcrumbList: {
    required: ['itemListElement'],
    recommended: [],
    collectionKey: 'itemListElement',
  },
  FAQPage: {
    required: ['mainEntity'],
    recommended: [],
    collectionKey: 'mainEntity',
    maxItems: 10,
  },
  ItemList: {
    required: ['itemListElement'],
    recommended: ['numberOfItems'],
    collectionKey: 'itemListElement',
  },
  LocalBusiness: {
    required: ['name'],
    recommended: ['address', 'telephone', 'image', 'url'],
  },
  ProfessionalService: {
    required: ['name'],
    recommended: ['address', 'areaServed', 'image', 'url'],
  },
  Service: { required: ['name'], recommended: ['provider', 'areaServed', 'description'] },
  Article: { required: ['headline'], recommended: ['author', 'datePublished', 'image'] },
  Product: { required: ['name'], recommended: ['image', 'offers', 'aggregateRating'] },
  Review: { required: ['reviewRating'], recommended: ['author', 'itemReviewed'] },
};

export interface RichResultIssue {
  severity: 'error' | 'warning';
  code:
    | 'unknown_type'
    | 'missing_required_field'
    | 'missing_recommended_field'
    | 'empty_collection'
    | 'collection_too_large'
    | 'invalid_item_shape'
    | 'brand_mismatch';
  type: string;
  message: string;
  field?: string;
}

export interface RichResultBlockReport {
  type: string;
  eligible: boolean;
  issues: RichResultIssue[];
}

export interface RichResultPageReport {
  path: string;
  eligible: boolean;
  blocks: RichResultBlockReport[];
  errorCount: number;
  warningCount: number;
}

export interface RichResultsReport {
  ok: boolean;
  generatedAt: string;
  pages: RichResultPageReport[];
  totals: { pages: number; eligiblePages: number; errors: number; warnings: number };
  /** Discrepâncias agregadas por tipo — facilita priorização. */
  errorsByType: Record<string, number>;
}

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && !value.trim()) ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0);

function validateBreadcrumbItems(items: unknown[], issues: RichResultIssue[]) {
  items.forEach((raw, i) => {
    const item = (raw || {}) as JsonLdObject;
    if (item['@type'] !== 'ListItem' || isEmpty(item.name) || isEmpty(item.position)) {
      issues.push({
        severity: 'error',
        code: 'invalid_item_shape',
        type: 'BreadcrumbList',
        field: `itemListElement[${i}]`,
        message: 'ListItem precisa de @type=ListItem, name e position.',
      });
    }
  });
}

function validateFaqItems(items: unknown[], issues: RichResultIssue[]) {
  items.forEach((raw, i) => {
    const item = (raw || {}) as JsonLdObject;
    const answer = (item.acceptedAnswer || {}) as JsonLdObject;
    if (item['@type'] !== 'Question' || isEmpty(item.name) || isEmpty(answer.text)) {
      issues.push({
        severity: 'error',
        code: 'invalid_item_shape',
        type: 'FAQPage',
        field: `mainEntity[${i}]`,
        message: 'Question precisa de name e acceptedAnswer.text.',
      });
    }
  });
}

/** Valida um bloco JSON-LD isolado quanto à elegibilidade para rich results. */
export function validateRichResultBlock(
  data: JsonLdObject | null | undefined,
  options: JsonLdAuditOptions & { skipBrandAudit?: boolean } = {},
): RichResultBlockReport {
  const issues: RichResultIssue[] = [];
  const type = String((data as JsonLdObject | undefined)?.['@type'] ?? '');

  if (!data || !type) {
    return {
      type: type || 'unknown',
      eligible: false,
      issues: [
        {
          severity: 'error',
          code: 'unknown_type',
          type: type || 'unknown',
          message: 'Bloco JSON-LD sem @type — inelegível para rich results.',
        },
      ],
    };
  }

  const rule = RICH_RESULT_RULES[type as RichResultType];
  if (!rule) {
    issues.push({
      severity: 'warning',
      code: 'unknown_type',
      type,
      message: `@type "${type}" não está no catálogo de rich results monitorado.`,
    });
  } else {
    for (const field of rule.required) {
      if (isEmpty(data[field])) {
        issues.push({
          severity: 'error',
          code: 'missing_required_field',
          type,
          field,
          message: `${type} exige "${field}" para rich result.`,
        });
      }
    }
    for (const field of rule.recommended) {
      if (isEmpty(data[field])) {
        issues.push({
          severity: 'warning',
          code: 'missing_recommended_field',
          type,
          field,
          message: `${type} sem "${field}" (recomendado pelo Google).`,
        });
      }
    }
    if (rule.collectionKey) {
      const collection = data[rule.collectionKey];
      const items = Array.isArray(collection) ? collection : [];
      if (items.length === 0 && !isEmpty(collection)) {
        issues.push({
          severity: 'error',
          code: 'empty_collection',
          type,
          field: rule.collectionKey,
          message: `${type}.${rule.collectionKey} deve ser uma lista não vazia.`,
        });
      }
      if (rule.maxItems && items.length > rule.maxItems) {
        issues.push({
          severity: 'warning',
          code: 'collection_too_large',
          type,
          field: rule.collectionKey,
          message: `${type} com ${items.length} itens (Google exibe até ${rule.maxItems}).`,
        });
      }
      if (type === 'BreadcrumbList') validateBreadcrumbItems(items, issues);
      if (type === 'FAQPage') validateFaqItems(items, issues);
    }
  }

  if (!options.skipBrandAudit) {
    const brand = auditJsonLd(data, options);
    for (const issue of brand.issues.filter((i) => i.severity === 'error')) {
      issues.push({
        severity: 'error',
        code: 'brand_mismatch',
        type,
        field: issue.path,
        message: issue.message,
      });
    }
  }

  return { type, eligible: !issues.some((i) => i.severity === 'error'), issues };
}

export interface RichResultPageInput {
  path: string;
  blocks: Array<JsonLdObject | null | undefined>;
}

/** Valida uma rota (todos os blocos JSON-LD renderizados nela). */
export function validateRichResultsPage(
  page: RichResultPageInput,
  options: JsonLdAuditOptions & { skipBrandAudit?: boolean } = {},
): RichResultPageReport {
  const blocks = page.blocks.map((b) => validateRichResultBlock(b, options));
  const errorCount = blocks.reduce(
    (acc, b) => acc + b.issues.filter((i) => i.severity === 'error').length,
    0,
  );
  const warningCount = blocks.reduce(
    (acc, b) => acc + b.issues.filter((i) => i.severity === 'warning').length,
    0,
  );
  return {
    path: page.path,
    eligible: blocks.length > 0 && errorCount === 0,
    blocks,
    errorCount,
    warningCount,
  };
}

/** Relatório agregado por conjunto de rotas — consumido por testes e CI. */
export function buildRichResultsReport(
  pages: RichResultPageInput[],
  options: JsonLdAuditOptions & { skipBrandAudit?: boolean } = {},
): RichResultsReport {
  const reports = pages.map((p) => validateRichResultsPage(p, options));
  const errorsByType: Record<string, number> = {};
  for (const page of reports) {
    for (const block of page.blocks) {
      const errors = block.issues.filter((i) => i.severity === 'error').length;
      if (errors) errorsByType[block.type] = (errorsByType[block.type] || 0) + errors;
    }
  }
  const errors = reports.reduce((a, p) => a + p.errorCount, 0);
  return {
    ok: errors === 0,
    generatedAt: new Date().toISOString(),
    pages: reports,
    totals: {
      pages: reports.length,
      eligiblePages: reports.filter((p) => p.eligible).length,
      errors,
      warnings: reports.reduce((a, p) => a + p.warningCount, 0),
    },
    errorsByType,
  };
}

/** Linhas de log legíveis (uma por discrepância) para CI/observabilidade. */
export function formatRichResultsLog(report: RichResultsReport): string[] {
  const lines: string[] = [];
  for (const page of report.pages) {
    for (const block of page.blocks) {
      for (const issue of block.issues) {
        lines.push(
          `[${issue.severity}] ${page.path} · ${block.type}${issue.field ? `.${issue.field}` : ''} — ${issue.message}`,
        );
      }
    }
  }
  return lines;
}
