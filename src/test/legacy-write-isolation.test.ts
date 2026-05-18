/**
 * Fase 1.7.3 — Legacy Write Isolation + Unsafe Path Quarantine.
 * 100% read-only. Sem Supabase, sem hooks.
 */
import { describe, expect, it } from 'vitest';
import {
  classifyBoundary,
  classifyOperation,
  classifyWritePath,
  explainWriteClassification,
} from '@/lib/drift/writeClassification';
import {
  LEGACY_WRITE_PATHS,
  QUARANTINED_WRITES,
  UNSAFE_PATTERNS,
  assertWriteAllowed,
  detectUnsafeWriteExpansion,
  explainQuarantineReason,
  isQuarantinedFile,
  isQuarantinedFlow,
  isQuarantinedWrite,
} from '@/lib/drift/quarantineRegistry';
import {
  calculateArchitectureScore,
  explainArchitectureScore,
  summarizeArchitectureHealth,
  summarizePlatformRisk,
} from '@/lib/drift/architectureScore';
import { assertNoUnsafeExpansion } from '@/lib/drift/assertNoUnsafeExpansion';
import { buildConsistencySnapshot } from '@/lib/drift/buildConsistencySnapshot';

describe('Fase 1.7.3 — Legacy isolation + quarantine + score', () => {
  it('A) classifica fluxos READY+tracker como SAFE', () => {
    const r = classifyWritePath('dashboard_profile_save');
    expect(r.classification).toBe('SAFE');
  });

  it('B) classifica boundary inline_call_site como LEGACY', () => {
    expect(classifyBoundary('inline_call_site').classification).toBe('LEGACY');
  });

  it('C) classifica operação destrutiva sem flow como GUARDED', () => {
    expect(classifyOperation('delete').classification).toBe('GUARDED');
    expect(classifyOperation('unknown').classification).toBe('UNKNOWN');
  });

  it('D) quarantine registry cobre paths críticos (AdminPage legacy)', () => {
    expect(QUARANTINED_WRITES.length).toBeGreaterThan(0);
    expect(LEGACY_WRITE_PATHS.length).toBeGreaterThan(0);
    expect(UNSAFE_PATTERNS.length).toBeGreaterThanOrEqual(4);
    expect(isQuarantinedFile('src/pages/AdminPage.tsx')).not.toBeNull();
    expect(isQuarantinedWrite({ file: 'src/pages/AdminPage.tsx' })).toBe(true);
    expect(isQuarantinedWrite({ file: 'src/pages/RandomPage.tsx' })).toBe(false);
    expect(isQuarantinedFlow('dashboard_profile_save' as any)).toBeNull();
  });

  it('E) detecta expansão unsafe fora da allow-list', () => {
    const expansions = detectUnsafeWriteExpansion([
      { file: 'src/pages/AdminPage.tsx', line: 10, table: 'profiles', severity: 'UNSAFE', reason: 'direct_update' },
      { file: 'src/pages/NewPage.tsx', line: 22, table: 'providers', severity: 'UNSAFE', reason: 'direct_update' },
      { file: 'src/lib/multiWriteSync.ts', line: 5, table: 'profiles', severity: 'SAFE', reason: 'inside_boundary' },
    ]);
    expect(expansions.length).toBe(1);
    expect(expansions[0].file).toBe('src/pages/NewPage.tsx');
  });

  it('F+G) score consistente e determinístico', () => {
    const s1 = calculateArchitectureScore();
    const s2 = calculateArchitectureScore();
    expect(s1.score).toBe(s2.score);
    expect(s1.grade).toBe(s2.grade);
    expect(s1.totalFlows).toBe(s2.totalFlows);
    expect(s1.classification).toEqual(s2.classification);
  });

  it('H) coverage % é coerente (0–100 e somatórios SAFE+GUARDED+LEGACY+UNSAFE+UNKNOWN=total)', () => {
    const s = calculateArchitectureScore();
    expect(s.coverage.boundaryCoveragePct).toBeGreaterThanOrEqual(0);
    expect(s.coverage.boundaryCoveragePct).toBeLessThanOrEqual(100);
    expect(s.coverage.atomicReadinessPct).toBeLessThanOrEqual(100);
    const sum =
      s.classification.SAFE +
      s.classification.GUARDED +
      s.classification.LEGACY +
      s.classification.UNSAFE +
      s.classification.UNKNOWN;
    expect(sum).toBe(s.totalFlows);
  });

  it('I) explainers determinísticos (strings puras, sem timestamp)', () => {
    const s = calculateArchitectureScore();
    const e1 = explainArchitectureScore(s);
    const e2 = explainArchitectureScore(s);
    expect(e1).toBe(e2);
    expect(e1).toContain('Architecture Score');

    const sum = summarizeArchitectureHealth(s);
    expect(sum).toContain('score=');
    expect(sum).toContain('grade=');

    const cls = classifyWritePath('dashboard_profile_save');
    expect(explainWriteClassification('dashboard_profile_save', cls)).toContain('classification=SAFE');

    expect(explainQuarantineReason(LEGACY_WRITE_PATHS[0])).toContain('QUARANTINE');
  });

  it('J) payload de telemetria não contém PII em nenhum helper exportado', async () => {
    // Static check: arquivos de observabilidade não referenciam chaves PII.
    const fs = await import('fs');
    const obs = fs.readFileSync('src/lib/drift/isolationObservability.ts', 'utf8');
    for (const piiKey of ['email', 'phone', 'whatsapp', 'cpf', 'cnpj', 'address']) {
      // banimos referências como `payload.email` ou `user.email`; permitimos comentários.
      const codeOnly = obs
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
        .join('\n');
      expect(codeOnly.toLowerCase()).not.toMatch(new RegExp(`[a-z_]*${piiKey}[a-z_]*\\s*:`));
    }
  });

  it('K) assertNoUnsafeExpansion sinaliza unsafe hits não quarentenados', () => {
    const r = assertNoUnsafeExpansion({
      unsafeHits: [
        { file: 'src/pages/RogueWrite.tsx', line: 1, table: 'profiles', severity: 'UNSAFE', reason: 'direct_update' },
      ],
      externalFlows: ['flow_nao_existente'],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === 'unsafe_path_not_quarantined')).toBe(true);
    expect(r.violations.some((v) => v.code === 'flow_outside_registry')).toBe(true);
  });

  it('L+M) registry atual passa em assertNoUnsafeExpansion (sem regressão estrutural)', () => {
    const r = assertNoUnsafeExpansion();
    // sem hits → não pode haver violations estruturais no registry atual
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('snapshot 1.7.2 ganhou campos da 1.7.3 (classification/quarantine/migration)', () => {
    const s = buildConsistencySnapshot('persist_first_service');
    expect(s).not.toBeNull();
    expect(typeof s!.classification).toBe('string');
    expect(typeof s!.architectureScoreImpact).toBe('number');
    expect(typeof s!.isQuarantined).toBe('boolean');
    // persist_first_service é PARTIAL + multi-step → exige migração atômica futura
    expect(s!.requiresAtomicMigration).toBe(true);
  });

  it('summarizePlatformRisk reflete saúde atual sem unsafe expansions', () => {
    const r = summarizePlatformRisk();
    expect(r.hasUnsafeFlows).toBe(false);
    expect(r.hasUnquarantinedLegacy).toBe(false);
    expect(r.recommendsAtomicMigration).toContain('persist_first_service');
  });

  it('assertWriteAllowed permite SAFE/GUARDED e bloqueia UNSAFE não quarentenado', () => {
    expect(assertWriteAllowed({ classification: 'SAFE' }).allowed).toBe(true);
    expect(assertWriteAllowed({ classification: 'GUARDED' }).allowed).toBe(true);
    expect(assertWriteAllowed({ classification: 'UNSAFE' }).allowed).toBe(false);
    expect(
      assertWriteAllowed({ classification: 'LEGACY', file: 'src/pages/AdminPage.tsx' }).allowed,
    ).toBe(true);
    expect(
      assertWriteAllowed({ classification: 'LEGACY', file: 'src/pages/Other.tsx' }).allowed,
    ).toBe(false);
  });
});
