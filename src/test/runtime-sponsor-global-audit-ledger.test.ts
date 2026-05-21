import { describe, expect, it } from 'vitest';
import {
  SPONSOR_AUDIT_INTERNALS,
  SPONSOR_AUDIT_LAYER_ORDER,
  SponsorAuditReplayDriftError,
  assertReplayDeterminism,
  buildAuditReplaySnapshot,
  buildGlobalAuditLedger,
  computeGlobalLineageGraph,
  correlateCrossLayerTraces,
  generateReplayFrames,
  lockAuditEnvelope,
  type SponsorLayerInputs,
} from '@/lib/runtimeSponsorGlobalAuditLedger';

function fixtureInputs(): SponsorLayerInputs {
  return {
    mesh: { signature: 'meshSIG01' },
    decision: { signature: 'deciSIG02' },
    campaign: { signature: 'campSIG03' },
    temporal: { signature: 'tempSIG04' },
    contract: { signature: 'contSIG05' },
    api: { signature: 'apiSIG006' },
    surface: { signature: 'surfSIG07' },
    consistency: { signature: 'consSIG08' },
  };
}

describe('Phase 1.9.22 · Sponsor Global Audit Ledger', () => {
  it('produces a bit-stable audit envelope for identical inputs', () => {
    const a = buildGlobalAuditLedger(fixtureInputs());
    const b = buildGlobalAuditLedger(fixtureInputs());
    expect(a.envelopeSignature).toBe(b.envelopeSignature);
    expect(a.replay.replaySignature).toBe(b.replay.replaySignature);
    expect(a.lineage.graphSignature).toBe(b.lineage.graphSignature);
    expect(a.correlation.chainSignature).toBe(b.correlation.chainSignature);
  });

  it('builds ledger entries in canonical layer order', () => {
    const env = buildGlobalAuditLedger(fixtureInputs());
    expect(env.ledger.map((e) => e.layer)).toEqual([...SPONSOR_AUDIT_LAYER_ORDER]);
    env.ledger.forEach((e, i) => {
      expect(e.index).toBe(i);
      expect(e.lineageRefs.length).toBe(i);
    });
  });

  it('skips missing layers without mutating ordering', () => {
    const env = buildGlobalAuditLedger({
      mesh: { signature: 'm' },
      decision: { signature: 'd' },
      api: { signature: 'a' },
    });
    expect(env.correlation.orderedLayers).toEqual(['mesh', 'decision', 'api']);
    expect(env.correlation.correlationMap.campaign).toBeNull();
    expect(env.correlation.correlationMap.consistency).toBeNull();
  });

  it('replay is deterministic across runs', () => {
    const r1 = generateReplayFrames(correlateCrossLayerTraces(fixtureInputs()));
    const r2 = generateReplayFrames(correlateCrossLayerTraces(fixtureInputs()));
    expect(() => assertReplayDeterminism(r1, r2)).not.toThrow();
  });

  it('detects replay drift when frame signatures diverge', () => {
    const r1 = generateReplayFrames(correlateCrossLayerTraces(fixtureInputs()));
    const mutated = fixtureInputs() as Record<string, { signature: string }>;
    mutated.api = { signature: 'apiSIG006_X' };
    const r2 = generateReplayFrames(correlateCrossLayerTraces(mutated as SponsorLayerInputs));
    expect(() => assertReplayDeterminism(r1, r2)).toThrow(SponsorAuditReplayDriftError);
  });

  it('lineage graph chains adjacent layers and is signed', () => {
    const env = buildGlobalAuditLedger(fixtureInputs());
    expect(env.lineage.nodes.length).toBe(env.correlation.orderedLayers.length);
    expect(env.lineage.edges.length).toBe(env.correlation.orderedLayers.length - 1);
    expect(env.lineage.graphSignature).toMatch(/^[0-9a-f]{8}$/);
  });

  it('envelope is deeply frozen and append-safe', () => {
    const env = buildGlobalAuditLedger(fixtureInputs());
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.ledger)).toBe(true);
    expect(() => {
      (env.ledger as unknown as unknown[]).push({} as never);
    }).toThrow();
    expect(() => {
      (env as unknown as { foo: number }).foo = 1;
    }).toThrow();
  });

  it('lockAuditEnvelope validates internal invariants', () => {
    const env = buildGlobalAuditLedger(fixtureInputs());
    expect(() => lockAuditEnvelope(env)).not.toThrow();
    expect(SPONSOR_AUDIT_INTERNALS.upstreamMutationAllowed).toBe(false);
    expect(SPONSOR_AUDIT_INTERNALS.recalculationAllowed).toBe(false);
    expect(SPONSOR_AUDIT_INTERNALS.businessLogicAllowed).toBe(false);
    expect(SPONSOR_AUDIT_INTERNALS.persistenceEnabled).toBe(false);
    expect(SPONSOR_AUDIT_INTERNALS.liveExecutionEnabled).toBe(false);
  });

  it('does NOT mutate upstream artifacts', () => {
    const inputs = fixtureInputs();
    const before = JSON.stringify(inputs);
    buildGlobalAuditLedger(inputs);
    buildGlobalAuditLedger(inputs);
    expect(JSON.stringify(inputs)).toBe(before);
  });

  it('correlation map respects canonical ordering regardless of insertion order', () => {
    const reordered: SponsorLayerInputs = {
      consistency: { signature: 'consSIG08' },
      surface: { signature: 'surfSIG07' },
      api: { signature: 'apiSIG006' },
      contract: { signature: 'contSIG05' },
      temporal: { signature: 'tempSIG04' },
      campaign: { signature: 'campSIG03' },
      decision: { signature: 'deciSIG02' },
      mesh: { signature: 'meshSIG01' },
    };
    const env = buildGlobalAuditLedger(reordered);
    const env2 = buildGlobalAuditLedger(fixtureInputs());
    expect(env.envelopeSignature).toBe(env2.envelopeSignature);
  });

  it('audit replay snapshot composes envelope + replay signatures', () => {
    const env = buildGlobalAuditLedger(fixtureInputs());
    const snap = buildAuditReplaySnapshot(env, env.replay);
    expect(snap.envelopeSignature).toBe(env.envelopeSignature);
    expect(snap.replaySignature).toBe(env.replay.replaySignature);
    expect(snap.compositeSignature).toMatch(/^[0-9a-f]{8}$/);
    expect(snap.locked).toBe(true);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('lineage edges form an ordered DAG chain', () => {
    const env = buildGlobalAuditLedger(fixtureInputs());
    env.lineage.edges.forEach(([from, to], i) => {
      expect(from).toBe(env.lineage.nodes[i].id);
      expect(to).toBe(env.lineage.nodes[i + 1].id);
    });
  });

  it('different upstream signatures yield different envelope signatures', () => {
    const a = buildGlobalAuditLedger(fixtureInputs());
    const variant = fixtureInputs() as Record<string, { signature: string }>;
    variant.temporal = { signature: 'tempSIG04Z' };
    const b = buildGlobalAuditLedger(variant as SponsorLayerInputs);
    expect(a.envelopeSignature).not.toBe(b.envelopeSignature);
    expect(a.replay.replaySignature).not.toBe(b.replay.replaySignature);
  });

  it('computeGlobalLineageGraph is pure (same input → same signature)', () => {
    const corr = correlateCrossLayerTraces(fixtureInputs());
    const g1 = computeGlobalLineageGraph(corr);
    const g2 = computeGlobalLineageGraph(corr);
    expect(g1.graphSignature).toBe(g2.graphSignature);
  });
});
