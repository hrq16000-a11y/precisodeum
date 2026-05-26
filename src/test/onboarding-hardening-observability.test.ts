/**
 * Hardening + Observabilidade do Onboarding V2 — pós-containment.
 *
 * Cobre:
 *  - Envelope v2 com checksum (FNV-1a) + validação de shape.
 *  - Descarte gracioso de envelopes v1 (sem versão) e corrompidos.
 *  - Validação de shape no recovery remoto.
 *  - Heartbeat multi-tab + detecção de concorrência.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fnv1a32, stableChecksum } from '@/lib/lightChecksum';
import {
  DRAFT_ENVELOPE_VERSION,
  computeDraftChecksum,
  validateDraftShape,
} from '@/components/onboarding/wizard/phases/v2/draftEnvelope';

const DRAFT_KEY = 'onboarding_v3_institutional_final';

function writeRaw(value: unknown) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('lightChecksum', () => {
  it('FNV-1a determinístico e estável', () => {
    expect(fnv1a32('hello')).toBe(fnv1a32('hello'));
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'));
    expect(fnv1a32('').length).toBe(8);
  });
  it('stableChecksum ignora ordem das chaves top-level', () => {
    const a = stableChecksum({ a: 1, b: 2 });
    const b = stableChecksum({ b: 2, a: 1 });
    expect(a).toBe(b);
  });
});

describe('draftEnvelope.validateDraftShape', () => {
  it('rejeita payload nulo', () => {
    expect(validateDraftShape(null as any).ok).toBe(false);
  });
  it('rejeita profile não-objeto', () => {
    expect(validateDraftShape({ profile: 'x', service: {}, phase: 'phase2_service' }).ok).toBe(false);
  });
  it('rejeita phase desconhecida', () => {
    const r = validateDraftShape({ profile: {}, service: {}, phase: 'phase_foo' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bad_phase');
  });
  it('aceita phase conhecida + objetos válidos', () => {
    expect(validateDraftShape({ profile: {}, service: {}, phase: 'phase2_details' }).ok).toBe(true);
    expect(validateDraftShape({ profile: {}, service: {}, phase: 'phase_repair_contact' }).ok).toBe(true);
  });
});

describe('useOnboardingV2Draft v2 envelope', () => {
  // Importa só agora para que beforeEach limpe storage antes.
  async function load() {
    return await import('@/components/onboarding/wizard/phases/v2/useOnboardingV2Draft');
  }

  it('descarta envelope v1 (sem version)', async () => {
    writeRaw({
      savedAt: Date.now(),
      profile: { whatsapp: '11999999999' },
      service: { service_name: 'Encanador' },
      phase: 'phase2_details',
    });
    const m = await load();
    expect(m.readOnboardingV2Draft()).toBeNull();
    expect(m.getLastReadDraftDiagnostics().reason).toBe('version_mismatch');
  });

  it('descarta envelope v2 com checksum inválido', async () => {
    writeRaw({
      version: DRAFT_ENVELOPE_VERSION,
      checksum: 'deadbeef',
      savedAt: Date.now(),
      profile: { whatsapp: '11999999999' },
      service: { service_name: 'Encanador' },
      phase: 'phase2_details',
    });
    const m = await load();
    expect(m.readOnboardingV2Draft()).toBeNull();
    expect(m.getLastReadDraftDiagnostics().reason).toBe('checksum_invalid');
  });

  it('aceita envelope v2 com checksum válido + conteúdo significativo', async () => {
    const profile = { whatsapp: '11999999999' };
    const service = { service_name: 'Encanador' };
    const phase = 'phase2_details';
    const checksum = computeDraftChecksum({ profile: profile as any, service: service as any, phase });
    writeRaw({
      version: DRAFT_ENVELOPE_VERSION,
      checksum,
      savedAt: Date.now(),
      profile, service, phase,
    });
    const m = await load();
    const out = m.readOnboardingV2Draft();
    expect(out).not.toBeNull();
    expect(out?.phase).toBe('phase2_details');
  });

  it('thin content é descartado mesmo com checksum ok', async () => {
    const profile = { whatsapp: '11' };
    const service = {};
    const phase = 'phase2_service';
    const checksum = computeDraftChecksum({ profile: profile as any, service: service as any, phase });
    writeRaw({
      version: DRAFT_ENVELOPE_VERSION,
      checksum,
      savedAt: Date.now(),
      profile, service, phase,
    });
    const m = await load();
    expect(m.readOnboardingV2Draft()).toBeNull();
    expect(m.getLastReadDraftDiagnostics().reason).toBe('thin_content');
  });

  it('envelope expirado (>7d) é descartado', async () => {
    writeRaw({
      version: DRAFT_ENVELOPE_VERSION,
      checksum: 'whatever',
      savedAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
      profile: { whatsapp: '11999999999' },
      service: { service_name: 'X' },
      phase: 'phase2_details',
    });
    const m = await load();
    expect(m.readOnboardingV2Draft()).toBeNull();
    expect(m.getLastReadDraftDiagnostics().reason).toBe('expired');
  });
});

describe('crossTabSync heartbeat', () => {
  it('detectConcurrentTab=false quando não há heartbeat de outra aba', async () => {
    const m = await import('@/components/onboarding/wizard/phases/v2/crossTabSync');
    expect(m.detectConcurrentTab()).toBe(false);
  });

  it('detectConcurrentTab=true quando outra aba escreveu heartbeat recente', async () => {
    const m = await import('@/components/onboarding/wizard/phases/v2/crossTabSync');
    // Simula outra aba: tabId diferente, updatedAt recente.
    localStorage.setItem(
      'onboarding_v2_active_tab',
      JSON.stringify({ tabId: 'outra-aba', updatedAt: Date.now() }),
    );
    expect(m.detectConcurrentTab()).toBe(true);
  });

  it('startTabHeartbeat retorna função de cleanup', async () => {
    vi.useFakeTimers();
    const m = await import('@/components/onboarding/wizard/phases/v2/crossTabSync');
    const stop = m.startTabHeartbeat();
    expect(typeof stop).toBe('function');
    stop();
    vi.useRealTimers();
  });
});
