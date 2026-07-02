/**
 * Fase 1.7.0 — Auditor estático de writes fora das boundaries oficiais.
 *
 * Recebe um conjunto de arquivos (path → conteúdo) e classifica cada
 * `supabase.from('X').update/insert/upsert/delete` em:
 *
 *   SAFE     → ocorre dentro de uma boundary oficial conhecida
 *              (multiWriteSync, avatarSync, onboardingProgressSync,
 *               adminWriteBoundary).
 *   LEGACY   → ocorre em arquivo legacy explicitamente tolerado
 *              (AdminPage.tsx — marcado como LEGACY na Fase 1.6.7).
 *   UNSAFE   → write em arquivo "vivo" fora das boundaries.
 *   UNKNOWN  → não foi possível classificar (ex.: tabela dinâmica).
 *
 * Ignora: arquivos sob `src/test/`, `__tests__/`, `*.test.*`, `*.spec.*`,
 * arquivos com `// boundary-allowlist: ...` no topo, e operações `select`
 * (readonly). NÃO faz I/O — caller passa o snapshot.
 */

export type UnsafeWriteSeverity = 'SAFE' | 'LEGACY' | 'UNSAFE' | 'UNKNOWN';

export interface UnsafeWriteHit {
  file: string;
  line: number;
  table: string | null;
  operation: 'update' | 'insert' | 'upsert' | 'delete' | 'unknown';
  severity: UnsafeWriteSeverity;
  reason: string;
}

const BOUNDARY_FILES = new Set<string>([
  'src/lib/multiWriteSync.ts',
  'src/lib/avatarSync.ts',
  'src/lib/onboardingProgressSync.ts',
  'src/lib/adminWriteBoundary.ts',
]);

const LEGACY_FILES = new Set<string>([
  'src/pages/AdminPage.tsx',
]);

const TEST_PATTERNS = [
  /(^|\/)src\/test\//,
  /(^|\/)__tests__\//,
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
];

function isTestFile(path: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(path));
}

const WRITE_REGEX =
  /supabase\s*\.\s*from\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*[\s\S]{0,400}?\.(update|insert|upsert|delete)\s*\(/g;

export interface DetectUnsafeWritesInput {
  files: Record<string, string>;
}

export interface DetectUnsafeWritesResult {
  hits: UnsafeWriteHit[];
  summary: Record<UnsafeWriteSeverity, number>;
}

export function detectUnsafeWrites(
  input: DetectUnsafeWritesInput,
): DetectUnsafeWritesResult {
  const hits: UnsafeWriteHit[] = [];
  const summary: Record<UnsafeWriteSeverity, number> = {
    SAFE: 0,
    LEGACY: 0,
    UNSAFE: 0,
    UNKNOWN: 0,
  };

  for (const [file, content] of Object.entries(input.files)) {
    if (isTestFile(file)) continue;
    if (/\/\/\s*boundary-allowlist/.test(content)) continue;

    WRITE_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WRITE_REGEX.exec(content)) !== null) {
      const table = m[1] || null;
      const op = (m[2] || 'unknown') as UnsafeWriteHit['operation'];
      const upto = content.slice(0, m.index);
      const line = upto.split('\n').length;

      let severity: UnsafeWriteSeverity;
      let reason: string;
      if (BOUNDARY_FILES.has(file)) {
        severity = 'SAFE';
        reason = 'inside_official_boundary';
      } else if (LEGACY_FILES.has(file)) {
        severity = 'LEGACY';
        reason = 'legacy_file_allowlist';
      } else if (!table) {
        severity = 'UNKNOWN';
        reason = 'dynamic_table_name';
      } else {
        severity = 'UNSAFE';
        reason = `direct_${op}_outside_boundary`;
      }
      summary[severity] += 1;
      hits.push({ file, line, table, operation: op, severity, reason });
    }
  }
  return { hits, summary };
}
