/**
 * Fase 1.7.1 — Drift Detection + Reconciliation Audit.
 *
 * A) contact mismatch detectado corretamente (provider account)
 * B) avatar mismatch respeita ownership (client não gera drift)
 * C) provider órfão detectado
 * D) onboarding flag mismatch detectado
 * E) mirrors válidos NÃO geram drift
 * F) telemetry sem PII (apenas chaves estruturais)
 * G) client profile sem provider NÃO é drift
 * H) detectAllDrifts agrega + severity correta
 * I) flow coverage 100% e detectores cobrem catálogo
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const logAuditAction = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/useAuditLog', () => ({
  logAuditAction: (...a: any[]) => logAuditAction(...a),
  useAuditLog: () => ({ logAction: logAuditAction }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}));

import {
  detectAllDrifts,
  detectAvatarDrift,
  detectContactDrift,
  detectProviderOwnershipDrift,
  detectOnboardingDrift,
  DRIFT_CATALOG,
  DRIFT_DETECTORS,
  FLOW_DRIFT_PROFILES,
  assertFlowCoverage,
  runDriftAudit,
  type DriftType,
} from '@/lib/drift';

beforeEach(() => logAuditAction.mockClear());

const ALLOWED_KEYS = new Set([
  'source', 'flow', 'drift_type', 'severity', 'ownership',
  'canonical_source', 'affected_boundary', 'auto_fixable',
  'subject', 'signals', 'error_code', 'reason',
]);

const PII_NEEDLES = ['@', '+55', 'gmail', 'rua ', '.com'];

describe('Fase 1.7.1 — drift detection', () => {
  it('A) detecta CONTACT_MISMATCH em conta provider', () => {
    const out = detectContactDrift(
      'provider',
      { phone: '11999990000', whatsapp: '11988887777' },
      { phone: '11999990000', whatsapp: '11900000000' },
    );
    expect(out.some((d) => d.type === 'CONTACT_MISMATCH' && d.subject === 'whatsapp')).toBe(true);
  });

  it('B) avatar mismatch só conta para provider; cliente não gera drift', () => {
    const client = detectAvatarDrift(
      'client',
      { avatar_url: 'a.png' },
      { photo_url: 'b.png' },
    );
    const provider = detectAvatarDrift(
      'provider',
      { avatar_url: 'a.png' },
      { photo_url: 'b.png' },
    );
    expect(client).toHaveLength(0);
    expect(provider[0].type).toBe('AVATAR_MISMATCH');
  });

  it('C) PROVIDER_WITHOUT_PROFILE / ORPHAN_PROVIDER detectado', () => {
    const out = detectProviderOwnershipDrift('provider', null, { id: 'p' });
    expect(out.map((d) => d.type)).toEqual(
      expect.arrayContaining(['PROVIDER_WITHOUT_PROFILE', 'ORPHAN_PROVIDER']),
    );
  });

  it('D) ONBOARDING_FLAG_MISMATCH detectado quando flags divergem', () => {
    const out = detectOnboardingDrift(
      'provider',
      { onboarding_completed: true },
      { onboarding_completed: false, onboarding_finished_at: null },
    );
    expect(out[0]?.type).toBe('ONBOARDING_FLAG_MISMATCH');
  });

  it('E) mirrors válidos NÃO geram drift', () => {
    const report = detectAllDrifts({
      profileType: 'provider',
      profile: {
        phone: '11999990000', whatsapp: '11999990000',
        avatar_url: 'x.png', onboarding_completed: true, city: 'são paulo',
      },
      provider: {
        phone: '11999990000', whatsapp: '11999990000',
        photo_url: 'x.png', onboarding_completed: true,
        onboarding_progress: {}, status: 'active', city: 'São Paulo',
      },
    });
    expect(report.hasDrift).toBe(false);
    expect(report.severity).toBe('info');
  });

  it('F) telemetry sem PII e com chaves estruturais', async () => {
    await runDriftAudit(
      { source: 'unit_test', flow: 'dashboard_profile_save' },
      {
        profileType: 'provider',
        profile: { whatsapp: '11999990000', avatar_url: 'a.png' },
        provider: { whatsapp: '11000000000', photo_url: 'b.png' },
      },
    );
    expect(logAuditAction).toHaveBeenCalled();
    for (const call of logAuditAction.mock.calls) {
      const details = call[0]?.details ?? {};
      for (const k of Object.keys(details)) expect(ALLOWED_KEYS.has(k)).toBe(true);
      const serialized = JSON.stringify(details).toLowerCase();
      for (const needle of PII_NEEDLES) expect(serialized).not.toContain(needle);
    }
  });

  it('G) client sem provider NÃO é drift', () => {
    const report = detectAllDrifts({
      profileType: 'client',
      profile: { whatsapp: '11999990000', avatar_url: 'a.png' },
      provider: null,
    });
    expect(report.hasDrift).toBe(false);
    expect(report.canonicalOwner).toBe('profile');
  });

  it('H) detectAllDrifts agrega + severity = max', () => {
    const report = detectAllDrifts({
      profileType: 'provider',
      profile: null,
      provider: { id: 'p' },
    });
    expect(report.hasDrift).toBe(true);
    // PROVIDER_WITHOUT_PROFILE = critical
    expect(report.severity).toBe('critical');
    expect(report.drifts.length).toBeGreaterThanOrEqual(2);
  });

  it('I) flow coverage 100% e detectores referenciam tipos do catálogo', () => {
    const cov = assertFlowCoverage();
    expect(cov.ok).toBe(true);
    expect(cov.missing).toEqual([]);
    expect(FLOW_DRIFT_PROFILES.length).toBeGreaterThanOrEqual(9);
    for (const det of DRIFT_DETECTORS) {
      for (const t of det.produces) {
        expect(DRIFT_CATALOG[t as DriftType]).toBeDefined();
      }
    }
    // todos do catálogo são auto_fixable=false na 1.7.1
    for (const def of Object.values(DRIFT_CATALOG)) {
      expect(def.auto_fixable).toBe(false);
    }
  });
});
