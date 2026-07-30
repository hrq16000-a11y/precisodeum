#!/usr/bin/env node
/**
 * Consolida os 3 relatórios da pipeline de portabilidade em um único
 * relatório de auditoria (JSON estruturado + resumo Markdown).
 *
 * Uso:
 *   node scripts/portability/migration-report.mjs <bundle.zip> [outDir]
 *
 * Lê:
 *   - <bundle>.zip                     → manifest.json + reports/coverage.json
 *   - <bundle>.zip.restore-report.json
 *   - <bundle>.zip.validation-report.json
 *
 * Escreve em <outDir> (default: ./portability-report):
 *   - migration-report.json  (auditoria completa, machine-readable)
 *   - migration-report.md    (resumo humano para o release)
 *   - user-ref-coverage.json (cobertura por user_ref)
 *
 * Exit code 0 = migração íntegra; 2 = houve falha/órfão.
 */
import JSZip from 'jszip';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const bundleFile = resolve(process.argv[2] || 'portability-user-ref-media.zip');
const outDir = resolve(process.argv[3] || 'portability-report');

const log = (entry) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    log({ level: 'warn', kind: 'report_missing', path: basename(path) });
    return null;
  }
}

const zip = await JSZip.loadAsync(await readFile(bundleFile));
const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
const coverage = manifest.coverage || {};
const restore = await readJsonIfExists(`${bundleFile}.restore-report.json`);
const validation = await readJsonIfExists(`${bundleFile}.validation-report.json`);

// ── Cobertura por user_ref ────────────────────────────────────────────────
const byUserRef = new Map();
for (const file of manifest.files || []) {
  const key = file.user_ref || '__sem_user_ref__';
  const acc = byUserRef.get(key) || { user_ref: key, files: 0, bytes: 0 };
  acc.files += 1;
  acc.bytes += file.bytes || 0;
  byUserRef.set(key, acc);
}
const validatedByRef = new Map();
for (const file of validation?.files || []) {
  const key = file.user_ref || '__sem_user_ref__';
  const acc = validatedByRef.get(key) || { ok: 0, failed: 0 };
  acc[file.ok ? 'ok' : 'failed'] += 1;
  validatedByRef.set(key, acc);
}
const userRefCoverage = [...byUserRef.values()]
  .map((row) => ({
    ...row,
    verified_ok: validatedByRef.get(row.user_ref)?.ok ?? 0,
    verified_failed: validatedByRef.get(row.user_ref)?.failed ?? 0,
  }))
  .sort((a, b) => b.files - a.files);

const exported = coverage.files_exported ?? (manifest.files || []).length;
const restored = restore?.report?.uploaded ?? 0;
const verified = validation?.report?.files_ok ?? 0;
const orphans = validation?.report?.active_media_without_user_ref
  ?? coverage.media_active_without_user_ref
  ?? 0;
const failures =
  (coverage.download_errors ?? 0)
  + (restore?.report?.errors ?? 0)
  + (validation?.report?.files_failed ?? 0);

const summary = {
  ok: failures === 0 && orphans === 0 && exported > 0 && verified === exported,
  bundle: basename(bundleFile),
  generated_at: new Date().toISOString(),
  media_exported: exported,
  media_restored: restored,
  media_verified: verified,
  orphans,
  failures,
  distinct_user_refs: byUserRef.size,
  stages: {
    export: { ok: (coverage.download_errors ?? 0) === 0, coverage },
    restore: restore?.report ?? null,
    validate: validation?.report ?? null,
  },
};

const md = `# Relatório de migração por \`user_ref\`

**Bundle:** \`${summary.bundle}\`
**Gerado em:** ${summary.generated_at}
**Status:** ${summary.ok ? 'ÍNTEGRO' : 'FALHOU'}

| Métrica | Valor |
| --- | ---: |
| Mídias exportadas | ${summary.media_exported} |
| Mídias restauradas | ${summary.media_restored} |
| Mídias verificadas (checksum) | ${summary.media_verified} |
| Órfãos (ativos sem user_ref) | ${summary.orphans} |
| Falhas totais | ${summary.failures} |
| user_refs distintos | ${summary.distinct_user_refs} |

## Top 20 user_ref por volume

| user_ref | arquivos | bytes | verificados | falhas |
| --- | ---: | ---: | ---: | ---: |
${userRefCoverage.slice(0, 20).map((r) => `| \`${r.user_ref}\` | ${r.files} | ${r.bytes} | ${r.verified_ok} | ${r.verified_failed} |`).join('\n')}

## Critérios de aprovação
- \`failures = 0\`
- \`orphans = 0\`
- \`media_verified = media_exported\`
`;

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, 'migration-report.json'), JSON.stringify({ summary, user_ref_coverage: userRefCoverage }, null, 2));
await writeFile(resolve(outDir, 'user-ref-coverage.json'), JSON.stringify(userRefCoverage, null, 2));
await writeFile(resolve(outDir, 'migration-report.md'), md);

log({ level: summary.ok ? 'info' : 'error', kind: 'migration_report', ...summary });
process.exit(summary.ok ? 0 : 2);
